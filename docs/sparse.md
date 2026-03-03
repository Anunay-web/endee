# Sparse Vector Search — Architecture & Internals

## Overview

Sparse vectors represent documents as a small set of `(term_id, weight)` pairs — most
dimensions are zero. Similarity is measured by the **dot product**: only the terms
that appear in *both* query and document contribute to the score.

An **inverted index** is the natural structure for this: instead of scanning every
document, we look up only the posting lists of the terms present in the query and
accumulate scores.

```
                    ┌─────────────────────────────────┐
                    │       SparseVectorStorage        │
                    │  (public API, transactions, rw   │
                    │   mutex, MDBX env management)    │
                    └──────────┬──────────────────────-┘
                               │ owns
                    ┌──────────▼──────────────────────-┐
                    │        InvertedIndex              │
                    │  (posting lists, search, SIMD,    │
                    │   quantization, pruning)          │
                    └──────────┬──────────────────────-┘
                               │ reads/writes
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
        ┌──────────┐   ┌─────────────┐   ┌───────────┐
        │sparse_docs│  │term_postings│   │ term_info_ │
        │  (MDBX)  │   │   (MDBX)   │   │ (in-memory)│
        └──────────┘   └─────────────┘   └───────────┘
        doc_id →        term_id →         term_id →
        packed vec      posting list      max_weight
```

---

## File map

| File | Role |
|---|---|
| `sparse_vector.hpp` | `SparseVector` struct — packing, unpacking, FP16 conversion, dot product |
| `inverted_index.hpp` | `InvertedIndex` class declaration, `PostingListHeader`, `PostingListEntry`, `PostingListView`, `PostingListIterator`, `ScoredDoc` |
| `inverted_index.cpp` | All implementation: search, SIMD helpers, MDBX storage, add/remove, pruning |
| `sparse_storage.hpp` | `SparseVectorStorage` — top-level API with MDBX env, RAII transactions, batch ops |

---

## Data structures

### SparseVector (`sparse_vector.hpp`)

A document or query represented as parallel arrays of term IDs and weights.

**Packed binary format** (what gets stored in `sparse_docs`):

```
┌──────────┬────────────────────────┬────────────────────────┐
│ nnz (u16)│  term_ids[] (u32 each) │  values[] (fp16 each)  │
│  2 bytes │     nnz × 4 bytes      │     nnz × 2 bytes      │
└──────────┴────────────────────────┴────────────────────────┘
```

- `nnz`: number of non-zero entries (max 65535).
- Term IDs are stored as `uint32_t`.
- Values are stored as IEEE-754 half-precision floats (FP16). Conversion is done
  inline via `float_to_fp16` / `fp16_to_float`.

**Dot product** has two variants:
1. **SparseVector × SparseVector** — two-pointer merge on sorted indices. O(n+m).
2. **SparseVector × packed bytes** (zero-copy) — reads term IDs and FP16 values
   directly from packed data via `reinterpret_cast` without allocating.

### PostingListHeader (`inverted_index.hpp`)

On-disk header at the start of every posting list value in MDBX:

```c++
struct PostingListHeader {  // 13 bytes, packed
    uint8_t  version;     // format version (currently 5)
    uint32_t n;           // total entries including tombstones
    uint32_t live_count;  // entries with value > 0
    float    max_value;   // largest weight (used for quantization & pruning)
};
```

### PostingListEntry

In-memory representation used during writes:

```c++
struct PostingListEntry {
    ndd::idInt doc_id;  // uint32_t
    float      value;   // 0.0 means tombstoned
};
```

### PostingListView

Zero-copy read view into an MDBX memory-mapped page. Returned by
`getReadOnlyPostingList()`. Pointers are valid for the lifetime of the read
transaction.

```c++
struct PostingListView {
    const uint32_t* doc_ids;   // sorted
    const void*     values;    // uint8_t* or float* depending on build
    uint32_t        count;
    uint8_t         value_bits; // 8 = quantized, 32 = raw float
    float           max_value;
};
```

### PostingListIterator

Forward-only cursor used during search. One per query term.

Key capabilities:
- `advanceToNextLive()` — skips tombstoned entries (SIMD-accelerated for uint8 mode).
- `advance(target_doc_id)` — SIMD binary search to jump to `doc_id >= target`.
- `upperBound()` — returns `global_max * term_weight`, used by the pruning step.

---

## Storage layer (MDBX)

### Named databases

| Database | Key | Value | Flags |
|---|---|---|---|
| `sparse_docs` | `doc_id` (uint32, integer key) | Packed `SparseVector` bytes | `MDBX_INTEGERKEY` |
| `term_postings` | `term_id` (uint32, integer key) | `PostingListHeader` + doc_ids + values | `MDBX_INTEGERKEY` |

### Posting list on-disk layout

```
┌──────────────────┬──────────────────────────┬────────────────────────────────┐
│ PostingListHeader │  doc_ids[] (u32, sorted) │  values[] (u8 quantized or f32)│
│    13 bytes       │      n × 4 bytes         │  n × 1 byte  OR  n × 4 bytes  │
└──────────────────┴──────────────────────────┴────────────────────────────────┘
```

### Quantization

By default, weights are stored as `uint8` values `[0..255]` relative to the posting
list's `max_value`:

```
quantize(val, max_val)   = round(val / max_val * 255)    clamped to [0, 255]
dequantize(val, max_val) = val * (max_val / 255)
```

Key detail: `quantize()` clamps live entries to a minimum of `1` so that `0` is
reserved exclusively as the tombstone marker.

The compile-time flag `NDD_INV_IDX_STORE_FLOATS` (set via CMake) switches to raw
`float` storage, doubling per-entry size but eliminating quantization error.

### In-memory cache: `term_info_`

On startup, `loadTermInfo()` scans every posting list header and populates
`term_info_[term_id] = max_value`. This cache is used during search to compute
pruning upper bounds without touching disk.

---

## Write path

### Adding documents (`addDocumentsBatch`)

1. Group all `(doc_id, value)` pairs by `term_id` across the batch.
2. Sort each term's update list by `doc_id`.
3. For each term: load the existing posting list, perform a **sorted merge** of
   old entries and new entries (duplicates take the new value), recompute
   `live_count` and `max_val`, and save.

### Removing a document (`removeDocument`)

For each term the document appears in:

1. Load the posting list.
2. Binary search for the `doc_id`.
3. Set its value to `0.0` (tombstone).
4. If the tombstone ratio `(total - live) / total` reaches
   `INV_IDX_COMPACTION_TOMBSTONE_RATIO` (default 10%), compact in-place by
   removing all tombstoned entries.
5. If compaction leaves the list empty, delete the posting list key entirely.

### Updating a document (`update_vector`)

1. Read the old vector from `sparse_docs`.
2. Remove the old vector's entries from the inverted index (tombstone path).
3. Overwrite the packed vector in `sparse_docs`.
4. Add the new vector's entries to the inverted index.

All writes are wrapped in a single MDBX read-write transaction.

### Concurrency model

- `SparseVectorStorage` holds a `std::shared_mutex`.
- Writes (`store`, `delete`, `update`) take a **unique lock**.
- Reads (`get_vector`) take a **shared lock**.
- `InvertedIndex` has its own `shared_mutex`: search takes a shared lock, add/remove
  take a unique lock.

---

## Search algorithm

The search computes top-K documents by dot-product similarity using **batched
score accumulation** with optional **pruning**.

### Step-by-step

**1. Open iterators**

For each query term with weight > 0, look up `term_info_` to check the term exists,
then obtain a `PostingListView` (zero-copy pointer into MDBX mmap). Wrap it in a
`PostingListIterator` positioned at the first live entry.

**2. Main loop — process doc IDs in batches**

The doc-ID space is swept in contiguous windows of `INV_IDX_SEARCH_BATCH_SZ`
(default 10,000).

```
batch_start = smallest current doc_id across all iterators
batch_end   = batch_start + BATCH_SZ - 1
```

**3a. Accumulate scores**

For each iterator, walk its entries with `doc_id` in `[batch_start, batch_end]`:

```
scores_buf[doc_id - batch_start] += doc_weight * query_weight
```

The inner loop is branch-light: it reads values directly from the zero-copy pointer
(dequantizing on the fly for uint8 mode) and skips tombstoned entries (`value == 0`).

**3b. Collect top-K**

Scan `scores_buf` for any score exceeding the current threshold. Maintain a min-heap
of size K. When the heap is full, the threshold is the smallest score in the heap.

Bitmap filtering (`RoaringBitmap`) is applied here: a doc is skipped if it is not in
the filter set.

**3c. Remove exhausted iterators**

Any iterator that has reached `EXHAUSTED_DOC_ID` is dropped from the active list.

**3d. Pruning (`pruneLongest`)**

After each batch, if the heap is full, attempt to prune:

1. Find the iterator with the most remaining entries (the "longest").
2. Compute its upper bound: `global_max_weight * query_weight`.
3. If the upper bound cannot beat the current K-th best score **and** no other
   iterator has a doc_id before the longest's current position:
   - If all other iterators are exhausted: mark the longest as exhausted too.
   - Otherwise: skip the longest forward to where the next-closest iterator sits.

This is a single-list pruning heuristic. It is effective when one term is very common
(long posting list) but its maximum weight contribution is low.

**4. Return results**

Pop the min-heap into a vector and reverse it to get descending score order.

### SIMD acceleration

Two hot paths have SIMD implementations with scalar fallbacks:

| Function | Purpose | Platforms |
|---|---|---|
| `findDocIdSIMD` | Find first `doc_id >= target` in a sorted u32 array | AVX-512, AVX2, SVE2, NEON |
| `findNextLiveSIMD` | Find first non-zero byte in a u8 value array | AVX-512, AVX2, SVE2, NEON |

The AVX2 path for `findDocIdSIMD` includes a scalar pre-check: if the last element
in the chunk is below target, the whole chunk is skipped without loading into a SIMD
register.

---

## Configurable settings

All defined in `src/utils/settings.hpp`:

| Constant | Default | Description |
|---|---|---|
| `INV_IDX_SEARCH_BATCH_SZ` | 10,000 | Number of doc IDs processed per scoring batch |
| `NEAR_ZERO` | 1e-9 | Threshold below which a max_value is treated as zero |
| `INV_IDX_COMPACTION_TOMBSTONE_RATIO` | 0.1 (10%) | Fraction of tombstones that triggers posting list compaction on delete |

CMake option:

| Option | Default | Description |
|---|---|---|
| `NDD_INV_IDX_STORE_FLOATS` | OFF | Store raw float32 values instead of uint8 quantized |

---

## TODOs / Things to be done

### Code quality
- [ ] **FP16 conversion** — `float_to_fp16` / `fp16_to_float` in `sparse_vector.hpp` are
  simplified implementations (comment says "use proper library in production").
  Consider using a battle-tested library or compiler intrinsics (e.g., `_cvtss_sh` /
  `_cvtsh_ss` on x86 with F16C).
- [ ] **nnz overflow** — `SparseVector::pack()` casts `indices.size()` to `uint16_t`
  with no check. If a vector has > 65535 non-zero entries, it silently wraps.
- [ ] **Unit tests** — No tests visible in `src/sparse/`. Add coverage for packing
  round-trips, dot product correctness, add/remove/search, quantization edge cases,
  and compaction.

### Storage & performance
- [ ] **Whole-list reads** — `getReadOnlyPostingList` loads the entire posting list
  into memory at once (noted in a code XXX comment). Investigate chunked or paged
  reads for very long posting lists on shared servers.
- [ ] **Runtime batch size** — `INV_IDX_SEARCH_BATCH_SZ` is compile-time constant
  (noted in a code XXX comment). Making it runtime-configurable would allow tuning
  for different workloads without recompilation.
- [ ] **Stale `term_info_`** — The in-memory max-weight cache is updated on save but
  never reduced when entries are tombstoned. Over time, stale high max_values weaken
  pruning effectiveness. Consider recalculating max on compaction.