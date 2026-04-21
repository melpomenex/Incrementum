#![allow(clippy::transmute_num_to_bytes)]

use core::{
    ops::{Add, BitAnd, BitOr, BitXor, Div, Mul, Sub},
    ptr::{read, read_unaligned, write, write_unaligned},
};

use half::f16;
use num_traits::Float;
use paste::paste;

use crate::Scalar;

use super::{cast, Simd, VRegister, WithSimd};

impl VRegister for u64 {}

pub struct Fallback;

impl super::seal::Sealed for Fallback {}

macro_rules! impl_binop_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> Self::Register {
                const LANES: usize = 8 / size_of::<$ty>();
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
                const LANES: usize = 8 / size_of::<$ty>();
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

macro_rules! impl_binop_scalar_full {
    ($func: ident, $intrinsic: path) => {
        paste! {
            #[inline(always)]
            fn [<$func>](a: Self::Register, b: Self::Register) -> Self::Register {
                $intrinsic(a, b)
            }
            #[inline(always)]
            fn [<$func _supported>]() -> bool {
                false
            }
        }
    };
}

macro_rules! impl_cmp_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<Self> {
                const LANES: usize = 8 / size_of::<$ty>();
                let a: [$ty; LANES] = cast!(a);
                let b: [$ty; LANES] = cast!(b);
                let mut out = [0u8; LANES];

                for i in 0..LANES {
                    out[i] = a[i].$intrinsic(&b[i]) as u8;
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
                const LANES: usize = 8 / size_of::<$ty>();
                let a: [$ty; LANES] = cast!(a);
                let mut out: $ty = a[0];

                #[allow(clippy::reversed_empty_ranges)]
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
                64 / $bits
            }
        })*
    };
}

impl Simd for Fallback {
    type Register = u64;
    type Mask8 = [u8; 8];
    type Mask16 = [u8; 4];
    type Mask32 = [u8; 2];
    type Mask64 = [u8; 1];

    lanes!(8, 16, 32, 64);

    impl_binop_scalar!(
        add,
        Add::add,
        u8,
        i8,
        u16,
        i16,
        f16,
        u32,
        i32,
        f32,
        u64,
        i64,
        f64
    );
    impl_binop_scalar!(
        sub,
        Sub::sub,
        u8,
        i8,
        u16,
        i16,
        f16,
        u32,
        i32,
        f32,
        u64,
        i64,
        f64
    );
    impl_binop_scalar!(div, Div::div, f16, f32, f64);
    impl_binop_scalar!(
        mul,
        Mul::mul,
        u8,
        i8,
        u16,
        i16,
        f16,
        u32,
        i32,
        f32,
        u64,
        i64,
        f64
    );
    impl_binop_scalar!(min, Ord::min, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_binop_scalar!(min, f16::min, f16);
    impl_binop_scalar!(min, f32::min, f32);
    impl_binop_scalar!(min, f64::min, f64);
    impl_binop_scalar!(max, Ord::max, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_binop_scalar!(max, f16::max, f16);
    impl_binop_scalar!(max, f32::max, f32);
    impl_binop_scalar!(max, f64::max, f64);

    impl_binop_scalar_full!(bitand, BitAnd::bitand);
    impl_binop_scalar_full!(bitor, BitOr::bitor);
    impl_binop_scalar_full!(bitxor, BitXor::bitxor);

    impl_unop_scalar!(recip, recip, f16, f32, f64);
    impl_unop_scalar!(abs, abs, i8, i16, f16, i32, f32, i64, f64);

    impl_cmp_scalar!(equals, eq, u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);
    impl_cmp_scalar!(
        greater_than,
        gt,
        u8,
        i8,
        u16,
        i16,
        f16,
        u32,
        i32,
        f32,
        u64,
        i64,
        f64
    );
    impl_cmp_scalar!(
        greater_than_or_equal,
        ge,
        u8,
        i8,
        u16,
        i16,
        f16,
        u32,
        i32,
        f32,
        u64,
        i64,
        f64
    );
    impl_cmp_scalar!(less_than, lt, u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);
    impl_cmp_scalar!(
        less_than_or_equal,
        le,
        u8,
        i8,
        u16,
        i16,
        f16,
        u32,
        i32,
        f32,
        u64,
        i64,
        f64
    );

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
        op.with_simd::<Self>()
    }

    #[inline(always)]
    unsafe fn mask_store_as_bool_8(out: *mut bool, mask: Self::Mask8) {
        write(out as _, mask);
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_16(out: *mut bool, mask: Self::Mask16) {
        write(out as _, mask);
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_32(out: *mut bool, mask: Self::Mask32) {
        write(out as _, mask);
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_64(out: *mut bool, mask: Self::Mask64) {
        write(out as _, mask);
    }
    #[inline(always)]
    fn mask_from_bools_8(bools: &[bool]) -> Self::Mask8 {
        let mask: [bool; 8] = bools.try_into().expect("Slice must be `lanes8` length");
        cast!(mask)
    }
    #[inline(always)]
    fn mask_from_bools_16(bools: &[bool]) -> Self::Mask16 {
        let mask: [bool; 4] = bools.try_into().expect("Slice must be `lanes16` length");
        cast!(mask)
    }
    #[inline(always)]
    fn mask_from_bools_32(bools: &[bool]) -> Self::Mask32 {
        let mask: [bool; 2] = bools.try_into().expect("Slice must be `lanes32` length");
        cast!(mask)
    }
    #[inline(always)]
    fn mask_from_bools_64(bools: &[bool]) -> Self::Mask64 {
        let mask: [bool; 1] = bools.try_into().expect("Slice must be `lanes64` length");
        cast!(mask)
    }

    #[inline(always)]
    unsafe fn load<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        Self::typed(unsafe { read(ptr as *const u64) })
    }
    #[inline(always)]
    unsafe fn load_unaligned<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        Self::typed(unsafe { read_unaligned(ptr as *const u64) })
    }
    #[inline(always)]
    unsafe fn load_low<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        Self::typed((unsafe { read_unaligned(ptr as *const u32) } as u64) << 32)
    }
    #[inline(always)]
    unsafe fn load_high<T: Scalar>(ptr: *const T) -> super::Vector<Self, T> {
        Self::typed(unsafe { read_unaligned((ptr as *const u32).add(1)) } as u64)
    }
    #[inline(always)]
    unsafe fn store<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        unsafe { write(ptr as *mut u64, cast!(*value)) };
    }
    #[inline(always)]
    unsafe fn store_unaligned<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        unsafe { write_unaligned(ptr as *mut u64, cast!(*value)) };
    }
    #[inline(always)]
    unsafe fn store_low<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        let value: Self::Register = cast!(value);
        unsafe { write(ptr as *mut u32, (value >> 32) as u32) };
    }
    #[inline(always)]
    unsafe fn store_high<T: Scalar>(ptr: *mut T, value: super::Vector<Self, T>) {
        let value: Self::Register = cast!(value);
        unsafe { write(ptr as *mut u32, value as u32) };
    }
    #[inline(always)]
    fn splat_i8(value: i8) -> Self::Register {
        cast!([value; 8])
    }
    #[inline(always)]
    fn splat_i16(value: i16) -> Self::Register {
        cast!([value; 4])
    }
    #[inline(always)]
    fn splat_i32(value: i32) -> Self::Register {
        cast!([value; 2])
    }
    #[inline(always)]
    fn splat_i64(value: i64) -> Self::Register {
        cast!(value)
    }
    #[inline(always)]
    fn mul_add_f16(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        let a: [f16; 4] = cast!(a);
        let b: [f16; 4] = cast!(b);
        let c: [f16; 4] = cast!(c);
        let mut out = [f16::default(); 4];

        for i in 0..4 {
            out[i] = a[i] * b[i] + c[i];
        }
        cast!(out)
    }
    #[inline(always)]
    fn mul_add_f16_supported() -> bool {
        false
    }
    #[inline(always)]
    fn mul_add_f32(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        let a: [f32; 2] = cast!(a);
        let b: [f32; 2] = cast!(b);
        let c: [f32; 2] = cast!(c);
        let mut out = [f32::default(); 2];

        for i in 0..2 {
            out[i] = a[i].mul_add(b[i], c[i]);
        }
        cast!(out)
    }
    #[inline(always)]
    fn mul_add_f32_supported() -> bool {
        false
    }
    #[inline(always)]
    fn mul_add_f64(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        let a: [f64; 1] = cast!(a);
        let b: [f64; 1] = cast!(b);
        let c: [f64; 1] = cast!(c);
        let mut out = [f64::default(); 1];

        for i in 0..1 {
            out[i] = a[i].mul_add(b[i], c[i]);
        }
        cast!(out)
    }
    #[inline(always)]
    fn mul_add_f64_supported() -> bool {
        false
    }

    fn bitnot(a: Self::Register) -> Self::Register {
        !a
    }

    fn bitnot_supported() -> bool {
        false
    }
}
