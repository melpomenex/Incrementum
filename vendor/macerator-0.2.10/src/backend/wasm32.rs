use core::{
    arch::wasm32::*,
    ops::{Add, Div, Mul, Sub},
    ptr::{read, read_unaligned, write, write_unaligned},
};

use half::f16;
use num_traits::real::Real;
use paste::paste;

use crate::{Scalar, WithSimd};

use super::{
    arch::{impl_simd, NullaryFnOnce},
    cast, impl_cmp_scalar, Simd, VRegister, Vector,
};

impl VRegister for v128 {}

const WIDTH: usize = size_of::<<Simd128 as Simd>::Register>() * 8;

pub struct Simd128;

impl super::seal::Sealed for Simd128 {}

macro_rules! impl_binop {
    ($name: ident, $intrinsic: ident, $($ty: ident x $lanes: literal),*) => {
        $(paste! {
            fn [<$name _ $ty>](a: Self::Register, b: Self::Register) -> Self::Register {
                unsafe { [<$ty x $lanes _ $intrinsic>](a, b) }
            }
            fn [<$name _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}

macro_rules! impl_unop {
    ($name: ident, $intrinsic: ident, $($ty: ident x $lanes: literal),*) => {
        $(paste! {
            fn [<$name _ $ty>](a: Self::Register) -> Self::Register {
                unsafe { [<$ty x $lanes _ $intrinsic>](a) }
            }
            fn [<$name _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}

macro_rules! impl_cmp {
    ($name: ident, $intrinsic: ident, $($ty: ident x $lanes: literal),*) => {
        $(paste! {
            fn [<$name _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<Self> {
                cast!([<$ty x $lanes _ $intrinsic>](a, b))
            }
            fn [<$name _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}

macro_rules! impl_binop_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> Self::Register {
                const LANES: usize = 16 / size_of::<$ty>();
                let a: [$ty; LANES] = cast!(a);
                let b: [$ty; LANES] = cast!(b);
                let mut out = [$ty::default(); LANES];

                for i in 0..LANES {
                    out[i] = $intrinsic(a[i], b[i]);
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

macro_rules! impl_unop_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> Self::Register {
                const LANES: usize = 16 / size_of::<$ty>();
                let a: [$ty; LANES] = cast!(a);
                let mut out = [$ty::default(); LANES];

                for i in 0..LANES {
                    out[i] = a[i].$intrinsic();
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

macro_rules! impl_reduce_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> $ty {
                const LANES: usize = 16 / size_of::<$ty>();
                let a: [$ty; LANES] = cast!(a);
                let mut out: $ty = a[0];

                for i in 1..LANES {
                    out = out.$intrinsic(a[i]);
                }
                out
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                false
            }
        })*
    };
}

macro_rules! lanes {
    ($($bits: literal),*) => {
        $(paste! {
            #[inline(always)]
            fn [<lanes $bits>]() -> usize {
                128 / $bits
            }
        })*
    };
}

impl Simd for Simd128 {
    type Register = v128;
    type Mask8 = Vector<Self, i8>;
    type Mask16 = Vector<Self, i16>;
    type Mask32 = Vector<Self, i32>;
    type Mask64 = Vector<Self, i64>;

    lanes!(8, 16, 32, 64);

    impl_binop!(add, add, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, u64 x 2, i64 x 2, f64 x 2);
    impl_binop!(sub, sub, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, u64 x 2, i64 x 2, f64 x 2);
    impl_binop!(mul, mul, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, u64 x 2, i64 x 2, f64 x 2);
    impl_binop!(div, div, f32 x 4, f64 x 2);
    impl_binop!(min, min, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, f64 x 2);
    impl_binop!(max, max, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, f64 x 2);

    impl_cmp!(equals, eq, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, u64 x 2, i64 x 2, f64 x 2);
    impl_cmp!(less_than, lt, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, i64 x 2, f64 x 2);
    impl_cmp!(less_than_or_equal, le, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, i64 x 2, f64 x 2);
    impl_cmp!(greater_than, gt, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, i64 x 2, f64 x 2);
    impl_cmp!(greater_than_or_equal, ge, u8 x 16, i8 x 16, u16 x 8, i16 x 8, u32 x 4, i32 x 4, f32 x 4, i64 x 2, f64 x 2);

    impl_unop!(abs, abs, i8 x 16, i16 x 8, i32 x 4, f32 x 4, i64 x 2, f64 x 2);

    impl_binop_scalar!(add, Add::add, f16);
    impl_binop_scalar!(sub, Sub::sub, f16);
    impl_binop_scalar!(mul, Mul::mul, u8, i8, f16);
    impl_binop_scalar!(div, Div::div, f16);
    impl_binop_scalar!(min, Ord::min, u64, i64);
    impl_binop_scalar!(min, f16::min, f16);
    impl_binop_scalar!(max, Ord::max, u64, i64);
    impl_binop_scalar!(max, f16::max, f16);

    impl_cmp_scalar!(equals, eq, f16: i16);
    impl_cmp_scalar!(greater_than, gt, f16: i16);
    impl_cmp_scalar!(greater_than_or_equal, ge, f16: i16);
    impl_cmp_scalar!(less_than_or_equal, le, f16: i16);
    impl_cmp_scalar!(less_than, lt, f16: i16);

    impl_unop_scalar!(abs, abs, f16);
    impl_unop_scalar!(recip, recip, f16, f32, f64);

    impl_reduce_scalar!(
        reduce_add,
        wrapping_add,
        u8,
        i8,
        u16,
        i16,
        u32,
        i32,
        u64,
        i64
    );
    impl_reduce_scalar!(reduce_add, add, f16, f32, f64);
    impl_reduce_scalar!(reduce_min, min, u8, i8, u16, i16, u32, i32, u64, i64, f16, f32, f64);
    impl_reduce_scalar!(reduce_max, max, u8, i8, u16, i16, u32, i32, u64, i64, f16, f32, f64);

    fn vectorize<Op: WithSimd>(op: Op) -> Op::Output {
        struct Impl<Op> {
            op: Op,
        }
        impl<Op: WithSimd> NullaryFnOnce for Impl<Op> {
            type Output = Op::Output;

            #[inline(always)]
            fn call(self) -> Self::Output {
                self.op.with_simd::<Simd128>()
            }
        }
        Self::run_vectorized(Impl { op })
    }

    #[inline(always)]
    unsafe fn mask_store_as_bool_8(out: *mut bool, mask: Self::Mask8) {
        let bools = Self::bitand(cast!(mask), Self::splat_i8(1));
        Self::store_unaligned(out as *mut u8, cast!(bools));
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_16(out: *mut bool, mask: Self::Mask16) {
        const LANES: usize = 128 / 16;
        let mask: [i16; LANES] = cast!(mask);
        for i in 0..LANES {
            *out.add(i) = mask[i] != 0;
        }
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_32(out: *mut bool, mask: Self::Mask32) {
        const LANES: usize = 128 / 32;
        let mask: [i32; LANES] = cast!(mask);
        for i in 0..LANES {
            *out.add(i) = mask[i] != 0;
        }
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_64(out: *mut bool, mask: Self::Mask64) {
        const LANES: usize = 128 / 64;
        let mask: [i64; LANES] = cast!(mask);
        for i in 0..LANES {
            *out.add(i) = mask[i] != 0;
        }
    }
    #[inline(always)]
    fn mask_from_bools_8(bools: &[bool]) -> Self::Mask8 {
        debug_assert_eq!(bools.len(), Self::lanes8());
        const LANES: usize = 128 / 8;
        let mut out = [0i8; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }
    #[inline(always)]
    fn mask_from_bools_16(bools: &[bool]) -> Self::Mask16 {
        debug_assert_eq!(bools.len(), Self::lanes16());
        const LANES: usize = 128 / 16;
        let mut out = [0i16; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }
    #[inline(always)]
    fn mask_from_bools_32(bools: &[bool]) -> Self::Mask32 {
        debug_assert_eq!(bools.len(), Self::lanes32());
        const LANES: usize = 128 / 32;
        let mut out = [0i32; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }
    #[inline(always)]
    fn mask_from_bools_64(bools: &[bool]) -> Self::Mask64 {
        debug_assert_eq!(bools.len(), Self::lanes64());
        const LANES: usize = 128 / 64;
        let mut out = [0i64; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }

    #[inline(always)]
    unsafe fn load<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        cast!(read(ptr as *const v128))
    }
    #[inline(always)]
    unsafe fn load_unaligned<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        cast!(read_unaligned(ptr as *const v128))
    }
    #[inline(always)]
    unsafe fn load_low<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        cast!(v128_load64_zero(ptr as _))
    }
    #[inline(always)]
    unsafe fn load_high<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        cast!(v128_load64_lane::<1>(
            Self::splat_u64(0),
            (ptr as *const u64).add(1)
        ))
    }
    #[inline(always)]
    unsafe fn store<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        unsafe { write(ptr as *mut v128, cast!(value)) };
    }
    #[inline(always)]
    unsafe fn store_unaligned<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        unsafe { write_unaligned(ptr as *mut v128, cast!(value)) };
    }
    #[inline(always)]
    unsafe fn store_low<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        unsafe { v128_store64_lane::<0>(cast!(value), ptr as _) };
    }
    #[inline(always)]
    unsafe fn store_high<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        unsafe { v128_store64_lane::<1>(cast!(value), ptr as _) };
    }
    #[inline(always)]
    fn splat_i8(value: i8) -> Self::Register {
        unsafe { i8x16_splat(value) }
    }
    #[inline(always)]
    fn splat_i16(value: i16) -> Self::Register {
        unsafe { i16x8_splat(value) }
    }
    #[inline(always)]
    fn splat_i32(value: i32) -> Self::Register {
        unsafe { i32x4_splat(value) }
    }
    #[inline(always)]
    fn splat_i64(value: i64) -> Self::Register {
        unsafe { i64x2_splat(value) }
    }
    #[inline(always)]
    fn bitand(a: Self::Register, b: Self::Register) -> Self::Register {
        unsafe { v128_and(a, b) }
    }
    #[inline(always)]
    fn bitand_supported() -> bool {
        true
    }
    #[inline(always)]
    fn bitor(a: Self::Register, b: Self::Register) -> Self::Register {
        unsafe { v128_or(a, b) }
    }
    #[inline(always)]
    fn bitor_supported() -> bool {
        true
    }
    #[inline(always)]
    fn bitxor(a: Self::Register, b: Self::Register) -> Self::Register {
        unsafe { v128_xor(a, b) }
    }
    #[inline(always)]
    fn bitxor_supported() -> bool {
        true
    }
    #[inline(always)]
    fn bitnot(a: Self::Register) -> Self::Register {
        unsafe { v128_not(a) }
    }
    #[inline(always)]
    fn bitnot_supported() -> bool {
        true
    }
    #[inline(always)]
    fn less_than_u64(a: Self::Register, b: Self::Register) -> <u64 as Scalar>::Mask<Self> {
        let bias = Self::splat_i64(i64::MIN);
        let a = Self::sub_u64(a, bias);
        let b = Self::sub_u64(b, bias);
        Self::less_than_i64(a, b)
    }
    #[inline(always)]
    fn less_than_u64_supported() -> bool {
        true
    }
    #[inline(always)]
    fn less_than_or_equal_u64(a: Self::Register, b: Self::Register) -> <u64 as Scalar>::Mask<Self> {
        let bias = Self::splat_i64(i64::MIN);
        let a = Self::sub_u64(a, bias);
        let b = Self::sub_u64(b, bias);
        Self::less_than_or_equal_i64(a, b)
    }
    #[inline(always)]
    fn less_than_or_equal_u64_supported() -> bool {
        true
    }
    #[inline(always)]
    fn greater_than_u64(a: Self::Register, b: Self::Register) -> <u64 as Scalar>::Mask<Self> {
        let bias = Self::splat_i64(i64::MIN);
        let a = Self::sub_u64(a, bias);
        let b = Self::sub_u64(b, bias);
        Self::greater_than_i64(a, b)
    }
    #[inline(always)]
    fn greater_than_u64_supported() -> bool {
        true
    }
    #[inline(always)]
    fn greater_than_or_equal_u64(
        a: Self::Register,
        b: Self::Register,
    ) -> <u64 as Scalar>::Mask<Self> {
        let bias = Self::splat_i64(i64::MIN);
        let a = Self::sub_u64(a, bias);
        let b = Self::sub_u64(b, bias);
        Self::greater_than_or_equal_i64(a, b)
    }
    #[inline(always)]
    fn greater_than_or_equal_u64_supported() -> bool {
        true
    }
    #[inline(always)]
    fn mul_add_f16(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        let a: [f16; 8] = cast!(a);
        let b: [f16; 8] = cast!(b);
        let c: [f16; 8] = cast!(c);
        let mut out = [f16::default(); 8];

        for i in 0..8 {
            out[i] = a[i].mul_add(b[i], c[i]);
        }
        cast!(out)
    }
    #[inline(always)]
    fn mul_add_f16_supported() -> bool {
        false
    }
    #[inline(always)]
    fn mul_add_f32(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        unsafe { f32x4_relaxed_madd(a, b, c) }
    }
    #[inline(always)]
    fn mul_add_f32_supported() -> bool {
        true
    }
    #[inline(always)]
    fn mul_add_f64(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        unsafe { f64x2_relaxed_madd(a, b, c) }
    }
    #[inline(always)]
    fn mul_add_f64_supported() -> bool {
        true
    }
}

impl Simd128 {
    impl_simd!("simd128");
}
