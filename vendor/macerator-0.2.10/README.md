# Macerator

Originally a thin wrapper around [`pulp`](https://github.com/sarah-quinones/pulp) to provide type-generic SIMD
operations using similar traits to the standard library, but now uses its own backend for more ergonomic
type inference behaviour and wider backend support. As backends are stabilized in Rust, the MSRV will
be increased and nightly requirements will be removed. For crates with a lower MSRV, older versions
should be automatically used by cargo.

## AVX-512 on Stable

To avoid a major MSRV bump, AVX-512 currently checks the rustc version and enables AVX-512 on stable
if it's 1.89 or greater. This will eventually be removed and replaced by an MSRV bump.

## Backends

| Feature set          | Tested on | Requires Nightly |
| -------------------- | --------- | ---------------- |
| x86_64-v2 (sse4.1)   | Hardware  | ❌                |
| x86_64-v3 (avx2)     | Hardware  | ❌                |
| x86_64-v4 (avx512)   | Hardware  | <1.89: ✅, >= 1.89: ❌ |
| aarch64 (Neon)       | Hardware  | ❌                |
| loongarch64 (lsx)    | QEMU      | ✅                |
| loongarch64 (lasx)   | QEMU      | ✅                |
| wasm32 (simd128)[^1] | Chrome    | ❌                |
| Any other target     | None[^2]  | ❌                |

[^1]: `wasm32` doesn't support runtime feature detection, so binary must be built
with `target_feature=+simd128`.
[^2]: Manually tested to ensure it builds, CI using QEMU may be added in the future. The scalar
backend is tested on all supported platforms.

`f16` support for `x86_64-v4` is disabled by default, since only one
Intel arch currently supports it, and AMD has no support. This may change as support expands. Note
that this also requires nightly, even once `avx512` stabilization is done.

## Example

```rust
fn clamp<S: Simd, T: VOrd>(value: Vector<S, T>, min: T, max: T) -> Vector<S, T> {
    let min = min.splat();
    let max = max.splat();
    value.min(max).max(min)
}
```
