#![allow(
    unknown_lints,
    unnecessary_transmutes, // for Rust nightly
    renamed_and_removed_lints,
    clippy::transmute_float_to_int,
    unused_unsafe,
    clippy::useless_transmute,
    clippy::missing_transmute_annotations,
    clippy::needless_range_loop,
)]

use bytemuck::{CheckedBitPattern, NoUninit, Pod, Zeroable};
use core::{fmt::Debug, marker::PhantomData, ops::Deref};
use half::{bf16, f16};
use paste::paste;

mod arch;
pub use arch::{Arch, WithSimd};

moddef::moddef!(
    pub(crate) mod {
        x86 for cfg(x86),
        aarch64 for cfg(aarch64),
        wasm32 for cfg(wasm32),
        loong64 for cfg(loong64),
        scalar
    }
);

use crate::{Scalar, VAdd};

pub trait VRegister: Copy + Pod + Debug {}

macro_rules! cast {
    ($v: expr) => {
        unsafe { core::mem::transmute($v) }
    };
}
pub(crate) use cast;

#[repr(C)]
pub struct Vector<S: Simd, T: Scalar> {
    inner: S::Register,
    _ty: PhantomData<T>,
}

impl<S: Simd, T: Scalar> Clone for Vector<S, T> {
    fn clone(&self) -> Self {
        *self
    }
}
impl<S: Simd, T: Scalar> Copy for Vector<S, T> {}
impl<S: Simd, T: Scalar> Debug for Vector<S, T> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_tuple("Vector").field(&self.inner).finish()
    }
}

unsafe impl<S: Simd, T: Scalar> Pod for Vector<S, T> {}
unsafe impl<S: Simd, T: Scalar> Zeroable for Vector<S, T> {}

impl<S: Simd, T: Scalar> Deref for Vector<S, T> {
    type Target = S::Register;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

macro_rules! declare_binop {
    ($name: ident, $($ty: ty),*) => {
        $(paste! {
            fn [<$name _ $ty>](a: Self::Register, b: Self::Register) -> Self::Register;
            fn [<$name _ $ty _supported>]() -> bool;
        })*
    };
}

macro_rules! declare_unop {
    ($name: ident, $($ty: ty),*) => {
        $(paste! {
            fn [<$name _ $ty>](a: Self::Register) -> Self::Register;
            fn [<$name _ $ty _supported>]() -> bool;
        })*
    };
}

macro_rules! declare_reduction {
    ($name: ident, $($ty: ty),*) => {
        $(paste! {
            fn [<$name _ $ty>](a: Self::Register) -> $ty;
            fn [<$name _ $ty _supported>]() -> bool;
        })*
    };
}

macro_rules! declare_cmp {
    ($name: ident, $($ty: ty),*) => {
        $(paste! {
            fn [<$name _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<Self>;
            fn [<$name _ $ty _supported>]() -> bool;
        })*
    };
}

macro_rules! splat {
    (float $($bits: literal),*) => {
        $(paste!{
            fn [<splat_i $bits>](value: [<i $bits>]) -> Self::Register;
            splat!(transmute $bits -> [<u $bits>]);
            splat!(transmute $bits -> [<f $bits>]);
        })*
    };
    (transmute $bits: literal -> $ty: ident) => {
        paste! {
            fn [<splat_ $ty>](value: $ty) -> Self::Register {
                Self::[<splat_i $bits>](unsafe { core::mem::transmute::<$ty, [<i $bits>]>(value) })
            }
        }
    };
}

pub(crate) mod seal {
    pub trait Sealed {}
}

pub trait Simd: Sized + seal::Sealed + 'static {
    type Register: VRegister;
    type Mask8: Debug + Copy + Send + Sync + Zeroable + NoUninit + CheckedBitPattern + 'static;
    type Mask16: Debug + Copy + Send + Sync + Zeroable + NoUninit + CheckedBitPattern + 'static;
    type Mask32: Debug + Copy + Send + Sync + Zeroable + NoUninit + CheckedBitPattern + 'static;
    type Mask64: Debug + Copy + Send + Sync + Zeroable + NoUninit + CheckedBitPattern + 'static;

    fn lanes8() -> usize;
    fn lanes16() -> usize;
    fn lanes32() -> usize;
    fn lanes64() -> usize;

    fn typed<T: Scalar>(reg: Self::Register) -> Vector<Self, T> {
        Vector {
            inner: reg,
            _ty: PhantomData,
        }
    }
    fn vectorize<Op: WithSimd>(op: Op) -> Op::Output;

    /// Store a `Mask8` as a set of booleans of `lanes8` width, converting as
    /// necessary.
    ///
    /// # SAFETY
    /// `out` must be valid for `lanes8` contiguous values.
    unsafe fn mask_store_as_bool_8(out: *mut bool, mask: Self::Mask8);
    /// Store a `Mask16` as a set of booleans of `lanes16` width, converting as
    /// necessary.
    ///
    /// # SAFETY
    /// `out` must be valid for `lanes16` contiguous values.
    unsafe fn mask_store_as_bool_16(out: *mut bool, mask: Self::Mask16);
    /// Store a `Mask32` as a set of booleans of `lanes32` width, converting as
    /// necessary.
    ///
    /// # SAFETY
    /// `out` must be valid for `lanes32` contiguous values.
    unsafe fn mask_store_as_bool_32(out: *mut bool, mask: Self::Mask32);
    /// Store a `Mask64` as a set of booleans of `lanes64` width, converting as
    /// necessary.
    ///
    /// # SAFETY
    /// `out` must be valid for `lanes64` contiguous values.
    unsafe fn mask_store_as_bool_64(out: *mut bool, mask: Self::Mask64);

    /// Converts a slice of booleans to a mask. Slice length must be equal to
    /// `lanes8`.
    fn mask_from_bools_8(bools: &[bool]) -> Self::Mask8;
    /// Converts a slice of booleans to a mask. Slice length must be equal to
    /// `lanes16`.
    fn mask_from_bools_16(bools: &[bool]) -> Self::Mask16;
    /// Converts a slice of booleans to a mask. Slice length must be equal to
    /// `lanes32`.
    fn mask_from_bools_32(bools: &[bool]) -> Self::Mask32;
    /// Converts a slice of booleans to a mask. Slice length must be equal to
    /// `lanes64`.
    fn mask_from_bools_64(bools: &[bool]) -> Self::Mask64;

    /// Load a vector from an aligned element pointer. Must be aligned to the
    /// whole vector.
    ///
    /// # Safety
    ///
    /// Same safety requirements as [`read`](std::ptr::read), with the
    /// additional requirement that the entire vector must be aligned and
    /// valid, not just the element at `ptr`.
    unsafe fn load<T: Scalar>(ptr: *const T) -> Vector<Self, T>;
    /// Load a vector from an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`read_unaligned`](std::ptr::read_unaligned), with the additional
    /// requirement that the entire vector must be valid, not just the
    /// element at `ptr`.
    unsafe fn load_unaligned<T: Scalar>(ptr: *const T) -> Vector<Self, T>;
    /// Load the lower half of a vector from an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`read_unaligned`](std::ptr::read_unaligned), with the additional
    /// requirement that the lower half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn load_low<T: Scalar>(ptr: *const T) -> Vector<Self, T>;
    /// Load the upper half of a vector from an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`read_unaligned`](std::ptr::read_unaligned), with the additional
    /// requirement that the upper half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn load_high<T: Scalar>(ptr: *const T) -> Vector<Self, T>;
    /// Store the lower half of a vector to an aligned element pointer. Must be
    /// aligned to the whole vector.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write`](std::ptr::write), with the additional
    /// requirement that the entire vector must be valid and aligned to the size
    /// of the full vectgor, not just the element at `ptr`.
    unsafe fn store<T: Scalar>(ptr: *mut T, value: Vector<Self, T>);
    /// Store the upper half of a vector to an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write_unaligned`](std::ptr::write_unaligned), with the additional
    /// requirement that the entire vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn store_unaligned<T: Scalar>(ptr: *mut T, value: Vector<Self, T>);
    /// Store the upper half of a vector to an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write_unaligned`](std::ptr::write_unaligned), with the additional
    /// requirement that the lower half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn store_low<T: Scalar>(ptr: *mut T, value: Vector<Self, T>);
    /// Store the upper half of a vector to an unaligned element pointer.
    ///
    /// # Safety
    ///
    /// Same safety requirements as
    /// [`write_unaligned`](std::ptr::write_unaligned), with the additional
    /// requirement that the upper half of the vector must be valid, not just
    /// the element at `ptr`.
    unsafe fn store_high<T: Scalar>(ptr: *mut T, value: Vector<Self, T>);

    fn splat_i8(value: i8) -> Self::Register;
    splat!(transmute 8 -> u8);
    splat!(transmute 16 -> bf16);
    splat!(float 16, 32, 64);

    fn add<T: VAdd>(a: Vector<Self, T>, b: Vector<Self, T>) -> Vector<Self, T> {
        T::vadd::<Self>(a, b)
    }

    declare_binop!(add, i8, u8, i16, u16, f16, i32, u32, f32, i64, u64, f64);
    declare_binop!(sub, i8, u8, i16, u16, f16, i32, u32, f32, i64, u64, f64);
    declare_binop!(div, f16, f32, f64);
    declare_binop!(mul, i8, u8, i16, u16, f16, i32, u32, f32, u64, i64, f64);
    declare_binop!(min, u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);
    declare_binop!(max, u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);

    fn bitand(a: Self::Register, b: Self::Register) -> Self::Register;
    fn bitand_supported() -> bool;
    fn bitor(a: Self::Register, b: Self::Register) -> Self::Register;
    fn bitor_supported() -> bool;
    fn bitxor(a: Self::Register, b: Self::Register) -> Self::Register;
    fn bitxor_supported() -> bool;
    fn bitnot(a: Self::Register) -> Self::Register;
    fn bitnot_supported() -> bool;

    declare_cmp!(equals, i8, u8, i16, u16, f16, i32, u32, f32, i64, u64, f64);
    declare_cmp!(less_than, i8, u8, i16, u16, f16, i32, u32, f32, i64, u64, f64);
    declare_cmp!(
        less_than_or_equal,
        i8,
        u8,
        i16,
        u16,
        f16,
        i32,
        u32,
        f32,
        i64,
        u64,
        f64
    );
    declare_cmp!(
        greater_than,
        i8,
        u8,
        i16,
        u16,
        f16,
        i32,
        u32,
        f32,
        i64,
        u64,
        f64
    );
    declare_cmp!(
        greater_than_or_equal,
        i8,
        u8,
        i16,
        u16,
        f16,
        i32,
        u32,
        f32,
        i64,
        u64,
        f64
    );

    fn mul_add_f16(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register;
    fn mul_add_f16_supported() -> bool;
    fn mul_add_f32(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register;
    fn mul_add_f32_supported() -> bool;
    fn mul_add_f64(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register;
    fn mul_add_f64_supported() -> bool;

    declare_unop!(recip, f16, f32, f64);
    declare_unop!(abs, i8, i16, i32, i64, f16, f32, f64);

    declare_reduction!(reduce_add, i8, i16, i32, i64, u8, u16, u32, u64, f16, f32, f64);
    declare_reduction!(reduce_min, i8, i16, i32, i64, u8, u16, u32, u64, f16, f32, f64);
    declare_reduction!(reduce_max, i8, i16, i32, i64, u8, u16, u32, u64, f16, f32, f64);
}

#[cfg(any(x86, aarch64, loong64, wasm32))]
macro_rules! impl_cmp_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty: $mask_ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<Self> {
                const LANES: usize = WIDTH / (8 * size_of::<$ty>());
                let a: [$ty; LANES] = cast!(a);
                let b: [$ty; LANES] = cast!(b);
                let mut out = [0; LANES];

                for i in 0..LANES {
                    out[i] = a[i].$intrinsic(&b[i]) as $mask_ty;
                }
                cast!(out)
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                false
            }
        })*
    };
}

#[cfg(any(x86, aarch64, loong64, wasm32))]
pub(crate) use impl_cmp_scalar;

/// Tests that type inference works properly
#[cfg(test)]
mod test_inference {
    use core::ptr::null;

    use crate::{
        backend::{Simd, Vector},
        vload, Scalar, VAdd,
    };

    #[allow(unused)]
    fn simd_splat<S: Simd, T: Scalar>() -> Vector<S, T> {
        let value = T::default();
        value.splat()
    }

    #[allow(unused)]
    fn load<S: Simd, T: Scalar>() -> Vector<S, T> {
        unsafe { vload(null()) }
    }

    #[allow(unused)]
    fn add<S: Simd, T: VAdd>() -> Vector<S, T> {
        let a = T::default().splat();
        let b = T::default().splat();
        a + b
    }
}
