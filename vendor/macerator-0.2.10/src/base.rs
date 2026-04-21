use crate::backend::{Simd, Vector};
use bytemuck::{CheckedBitPattern, NoUninit, Pod, Zeroable};
use core::fmt::Debug;
use half::{bf16, f16};
use paste::paste;

pub trait Scalar: Sized + Copy + Pod + NoUninit + Default {
    type Mask<S: Simd>: Debug
        + Copy
        + Send
        + Sync
        + Zeroable
        + NoUninit
        + CheckedBitPattern
        + 'static;

    fn lanes<S: Simd>() -> usize;

    /// Convert slice into a head slice containing as many vectorized values as
    /// possible, and a tail slice, containing the leftover elements.
    fn align_to<S: Simd>(data: &[Self]) -> (&[Self], &[Vector<S, Self>], &[Self]) {
        unsafe { data.align_to() }
    }
    /// Load a vector from an aligned element pointer. Must be aligned to the
    /// whole vector.
    ///
    /// # Safety
    ///
    /// Same safety requirements as [`read`](std::ptr::read), with the
    /// additional requirement that the entire vector must be aligned and
    /// valid, not just the element at `ptr`.
    unsafe fn vload<S: Simd>(ptr: *const Self) -> Vector<S, Self>;
    /// Load a vector from an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`read_unaligned`](std::ptr::read_unaligned), with the additional
    /// requirement that the entire vector must be valid, not just the
    /// element at `ptr`.
    unsafe fn vload_unaligned<S: Simd>(ptr: *const Self) -> Vector<S, Self>;
    /// Load the lower half of a vector from an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`read_unaligned`](std::ptr::read_unaligned), with the additional
    /// requirement that the lower half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn vload_low<S: Simd>(ptr: *const Self) -> Vector<S, Self>;
    /// Load the upper half of a vector from an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`read_unaligned`](std::ptr::read_unaligned), with the additional
    /// requirement that the upper half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn vload_high<S: Simd>(ptr: *const Self) -> Vector<S, Self>;
    /// Store the lower half of a vector to an aligned element pointer. Must be
    /// aligned to the whole vector.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write`](std::ptr::write), with the additional
    /// requirement that the entire vector must be valid and aligned to the size
    /// of the full vectgor, not just the element at `ptr`.
    unsafe fn vstore<S: Simd>(ptr: *mut Self, value: Vector<S, Self>);
    /// Store the upper half of a vector to an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write_unaligned`](std::ptr::write_unaligned), with the additional
    /// requirement that the entire vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn vstore_unaligned<S: Simd>(ptr: *mut Self, value: Vector<S, Self>);
    /// Store the upper half of a vector to an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write_unaligned`](std::ptr::write_unaligned), with the additional
    /// requirement that the lower half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn vstore_low<S: Simd>(ptr: *mut Self, value: Vector<S, Self>);
    /// Store the upper half of a vector to an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write_unaligned`](std::ptr::write_unaligned), with the additional
    /// requirement that the upper half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn vstore_high<S: Simd>(ptr: *mut Self, value: Vector<S, Self>);

    /// Store a `Mask` as a set of booleans of `lanes` width, converting as
    /// necessary.
    ///
    /// # SAFETY
    /// `out` must be valid for `lanes` contiguous values.
    unsafe fn mask_store_as_bool<S: Simd>(out: *mut bool, mask: Self::Mask<S>);
    /// Converts a slice of booleans to a mask. Slice length must be equal to
    /// `lanes`.
    fn mask_from_bools<S: Simd>(bools: &[bool]) -> Self::Mask<S>;
    /// Create a vector with the scalar `value` in each element.
    fn splat<S: Simd>(self) -> Vector<S, Self>;
}

macro_rules! impl_vectorizable {
    ($ty: ty, $bits: literal) => {
        paste! {
            impl Scalar for $ty {
                type Mask<S: Simd> = S::[<Mask $bits>];

                fn lanes<S: Simd>() -> usize {
                    S::[<lanes $bits>]()
                }

                #[inline(always)]
                unsafe fn vload<S: Simd>(ptr: *const Self) -> Vector<S, Self> {
                    unsafe { S::load(ptr) }
                }
                #[inline(always)]
                unsafe fn vload_unaligned<S: Simd>(ptr: *const Self) -> Vector<S, Self> {
                    unsafe { S::load_unaligned(ptr) }
                }
                #[inline(always)]
                unsafe fn vload_low<S: Simd>(ptr: *const Self) -> Vector<S, Self> {
                    unsafe { S::load_low(ptr) }
                }
                #[inline(always)]
                unsafe fn vload_high<S: Simd>(ptr: *const Self) -> Vector<S, Self> {
                    unsafe { S::load_high(ptr) }
                }
                #[inline(always)]
                unsafe fn vstore<S: Simd>(ptr: *mut Self, value: Vector<S, Self>) {
                    unsafe { S::store(ptr, value) }
                }
                #[inline(always)]
                unsafe fn vstore_unaligned<S: Simd>(ptr: *mut Self, value: Vector<S, Self>) {
                    unsafe { S::store_unaligned(ptr, value) }
                }
                #[inline(always)]
                unsafe fn vstore_low<S: Simd>(ptr: *mut Self, value: Vector<S, Self>) {
                    unsafe { S::store_low(ptr, value) }
                }
                #[inline(always)]
                unsafe fn vstore_high<S: Simd>(ptr: *mut Self, value: Vector<S, Self>) {
                    unsafe { S::store_high(ptr, value) }
                }
                #[inline(always)]
                unsafe fn mask_store_as_bool<S: Simd>(out: *mut bool, mask: Self::Mask<S>) {
                    S::[<mask_store_as_bool_ $bits>](out, mask);
                }
                #[inline(always)]
                fn mask_from_bools<S: Simd>(bools: &[bool]) -> Self::Mask<S> {
                    S::[<mask_from_bools_ $bits>](bools)
                }
                #[inline(always)]
                fn splat<S: Simd>(self) -> Vector<S, Self> {
                    S::typed(S::[<splat_ $ty>](self))
                }
            }
        }
    };
}

impl_vectorizable!(u8, 8);
impl_vectorizable!(i8, 8);
impl_vectorizable!(u16, 16);
impl_vectorizable!(i16, 16);
impl_vectorizable!(u32, 32);
impl_vectorizable!(i32, 32);
impl_vectorizable!(f16, 16);
impl_vectorizable!(bf16, 16);
impl_vectorizable!(f32, 32);
impl_vectorizable!(u64, 64);
impl_vectorizable!(i64, 64);
impl_vectorizable!(f64, 64);

/// Load a vector from an aligned element pointer. Must be aligned to the
/// whole vector.
///
/// # Safety
///
/// Same safety requirements as [`read`](std::ptr::read), with the
/// additional requirement that the entire vector must be aligned and
/// valid, not just the element at `ptr`.
pub unsafe fn vload<S: Simd, T: Scalar>(ptr: *const T) -> Vector<S, T> {
    unsafe { T::vload(ptr) }
}
/// Load a vector from an unaligned element pointer.
///
/// # Safety
///
/// Same safety requirements as
/// [`read_unaligned`](std::ptr::read_unaligned), with the additional
/// requirement that the entire vector must be valid, not just the
/// element at `ptr`.
pub unsafe fn vload_unaligned<S: Simd, T: Scalar>(ptr: *const T) -> Vector<S, T> {
    unsafe { T::vload_unaligned(ptr) }
}
/// Load the lower half of a vector from an unaligned element pointer.
///
/// # Safety
///
/// Same safety requirements as
/// [`read_unaligned`](std::ptr::read_unaligned), with the additional
/// requirement that the lower half of the vector must be valid, not just
/// the element at `ptr`.
pub unsafe fn vload_low<S: Simd, T: Scalar>(ptr: *const T) -> Vector<S, T> {
    unsafe { T::vload_low(ptr) }
}
/// Load the upper half of a vector from an unaligned element pointer.
///
/// # Safety
///
/// Same safety requirements as
/// [`read_unaligned`](std::ptr::read_unaligned), with the additional
/// requirement that the upper half of the vector must be valid, not just
/// the element at `ptr`.
pub unsafe fn vload_high<S: Simd, T: Scalar>(ptr: *const T) -> Vector<S, T> {
    unsafe { T::vload_high(ptr) }
}
/// Store the lower half of a vector to an aligned element pointer. Must be
/// aligned to the whole vector.
///
/// # Safety
///
/// Same safety requirements as
/// [`write`](std::ptr::write), with the additional
/// requirement that the entire vector must be valid and aligned to the size
/// of the full vectgor, not just the element at `ptr`.
pub unsafe fn vstore<S: Simd, T: Scalar>(ptr: *mut T, value: Vector<S, T>) {
    unsafe { T::vstore(ptr, value) };
}
/// Store the upper half of a vector to an unaligned element pointer.
///
/// # Safety
///
/// Same safety requirements as
/// [`write_unaligned`](std::ptr::write_unaligned), with the additional
/// requirement that the entire vector must be valid, not just
/// the element at `ptr`.
pub unsafe fn vstore_unaligned<S: Simd, T: Scalar>(ptr: *mut T, value: Vector<S, T>) {
    unsafe { T::vstore_unaligned(ptr, value) };
}
/// Store the upper half of a vector to an unaligned element pointer.
///
/// # Safety
///
/// Same safety requirements as
/// [`write_unaligned`](std::ptr::write_unaligned), with the additional
/// requirement that the lower half of the vector must be valid, not just
/// the element at `ptr`.
pub unsafe fn vstore_low<S: Simd, T: Scalar>(ptr: *mut T, value: Vector<S, T>) {
    unsafe { T::vstore_low(ptr, value) };
}
/// Store the upper half of a vector to an unaligned element pointer.
///
/// # Safety
///
/// Same safety requirements as
/// [`write_unaligned`](std::ptr::write_unaligned), with the additional
/// requirement that the upper half of the vector must be valid, not just
/// the element at `ptr`.
pub unsafe fn vstore_high<S: Simd, T: Scalar>(ptr: *mut T, value: Vector<S, T>) {
    unsafe { T::vstore_high(ptr, value) };
}
