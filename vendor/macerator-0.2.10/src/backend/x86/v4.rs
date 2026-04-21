use core::{
    arch::x86_64::*,
    marker::PhantomData,
    ops::{Add, Div, Mul, Sub},
};

use half::f16;
use num_traits::real::Real;
use paste::paste;

use crate::{backend::arch::*, cast, seal::Sealed, Scalar, Simd, VRegister, Vector};

use super::*;

pub type V4 = V4Impl<FP16Fallback>;
#[cfg(feature = "fp16")]
pub type V4FP16 = V4Impl<FP16Intrinsic>;

impl VRegister for __m512 {}

const WIDTH: usize = size_of::<<V4 as Simd>::Register>() * 8;

macro_rules! with_ty_cmp {
    ($func: ident, f16, $op: expr) => {
        paste!([<$func _ph_mask>]::<$op>)
    };
    ($func: ident, f32, $op: expr) => {
        paste!([<$func _ps_mask>]::<$op>)
    };
    ($func: ident, f64, $op: expr) => {
        paste!([<$func _pd_mask>]::<$op>)
    };
    ($func: ident, $ty: ident, $op: expr) => {
        paste!([<$func _ep $ty _mask>]::<$op>)
    }
}

#[cfg(fp16)]
macro_rules! impl_cmp_fp16 {
    ($func: ident, $op: expr, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<V4Impl<Self>> {
                cast!(with_ty_cmp!(_mm512_cmp, $ty, $op)(cast!(a), cast!(b)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}

macro_rules! impl_cmp_scalar {
    ($func: ident, $intrinsic: path, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> __mmask32 {
                const LANES: usize = WIDTH / (8 * size_of::<$ty>());
                let a: [$ty; LANES] = cast!(a);
                let b: [$ty; LANES] = cast!(b);
                let mut out = 0;

                for i in 0..LANES {
                    out |= (a[i].$intrinsic(&b[i]) as __mmask32) << i;
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

macro_rules! impl_reduce_split {
    ($func: ident, $intrinsic: expr, $op: ident, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register) -> $ty {
                unsafe {
                    let lo = _mm512_castsi512_si256(cast!(a));
                    let hi = _mm512_extracti64x4_epi64::<1>(cast!(a));
                    with_ty!($intrinsic, $ty)(lo).$op(with_ty!($intrinsic, $ty)(hi))
                }
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}

pub trait FP16Ext: Sealed + 'static {
    type Register: VRegister;

    fn add_f16(a: __m512, b: __m512) -> __m512;
    fn add_f16_supported() -> bool;
    fn sub_f16(a: __m512, b: __m512) -> __m512;
    fn sub_f16_supported() -> bool;
    fn mul_f16(a: __m512, b: __m512) -> __m512;
    fn mul_f16_supported() -> bool;
    fn div_f16(a: __m512, b: __m512) -> __m512;
    fn div_f16_supported() -> bool;
    fn min_f16(a: __m512, b: __m512) -> __m512;
    fn min_f16_supported() -> bool;
    fn max_f16(a: __m512, b: __m512) -> __m512;
    fn max_f16_supported() -> bool;

    fn equals_f16(a: __m512, b: __m512) -> __mmask32;
    fn equals_f16_supported() -> bool;
    fn less_than_f16(a: __m512, b: __m512) -> __mmask32;
    fn less_than_f16_supported() -> bool;
    fn less_than_or_equal_f16(a: __m512, b: __m512) -> __mmask32;
    fn less_than_or_equal_f16_supported() -> bool;
    fn greater_than_or_equal_f16(a: __m512, b: __m512) -> __mmask32;
    fn greater_than_or_equal_f16_supported() -> bool;
    fn greater_than_f16(a: __m512, b: __m512) -> __mmask32;
    fn greater_than_f16_supported() -> bool;

    fn mul_add_f16(a: __m512, b: __m512, c: __m512) -> __m512;
    fn mul_add_f16_supported() -> bool;

    fn abs_f16(a: __m512) -> __m512;
    fn abs_f16_supported() -> bool;
    fn recip_f16(a: __m512) -> __m512;
    fn recip_f16_supported() -> bool;

    fn reduce_add_f16(a: __m512) -> f16;
    fn reduce_add_f16_supported() -> bool;
    fn reduce_min_f16(a: __m512) -> f16;
    fn reduce_min_f16_supported() -> bool;
    fn reduce_max_f16(a: __m512) -> f16;
    fn reduce_max_f16_supported() -> bool;
}

pub struct FP16Fallback;
#[cfg(feature = "fp16")]
pub struct FP16Intrinsic;

impl Sealed for FP16Fallback {}
impl FP16Ext for FP16Fallback {
    type Register = __m512;

    impl_binop_scalar!(add, Add::add, f16);
    impl_binop_scalar!(sub, Sub::sub, f16);
    impl_binop_scalar!(mul, Mul::mul, f16);
    impl_binop_scalar!(div, Div::div, f16);
    impl_binop_scalar!(min, f16::min, f16);
    impl_binop_scalar!(max, f16::max, f16);

    impl_cmp_scalar!(equals, eq, f16);
    impl_cmp_scalar!(greater_than, gt, f16);
    impl_cmp_scalar!(greater_than_or_equal, ge, f16);
    impl_cmp_scalar!(less_than_or_equal, le, f16);
    impl_cmp_scalar!(less_than, lt, f16);

    impl_unop_scalar!(abs, abs, f16);
    impl_unop_scalar!(recip, recip, f16);

    impl_reduce_scalar!(reduce_add, add, f16);
    impl_reduce_scalar!(reduce_min, min, f16);
    impl_reduce_scalar!(reduce_max, max, f16);

    #[inline(always)]
    fn mul_add_f16(a: __m512, b: __m512, c: __m512) -> __m512 {
        const LANES: usize = WIDTH / 16;
        let a: [f16; LANES] = cast!(a);
        let b: [f16; LANES] = cast!(b);
        let c: [f16; LANES] = cast!(c);
        let mut out = [f16::default(); LANES];

        for i in 0..LANES {
            out[i] = a[i] * b[i] + c[i];
        }
        cast!(out)
    }
    #[inline(always)]
    fn mul_add_f16_supported() -> bool {
        false
    }
}

#[cfg(fp16)]
impl Sealed for FP16Intrinsic {}
#[cfg(fp16)]
impl FP16Ext for FP16Intrinsic {
    type Register = __m512;

    impl_binop_signless!(add, _mm512_add, f16);
    impl_binop_signless!(sub, _mm512_sub, f16);
    impl_binop_signless!(mul, _mm512_mul, f16);
    impl_binop_signless!(div, _mm512_div, f16);
    impl_binop_signless!(min, _mm512_min, f16);
    impl_binop_signless!(max, _mm512_max, f16);

    impl_cmp_fp16!(equals, _CMP_EQ_OQ, f16);
    impl_cmp_fp16!(less_than, _CMP_LT_OQ, f16);
    impl_cmp_fp16!(greater_than, _CMP_GT_OQ, f16);
    impl_cmp_fp16!(less_than_or_equal, _CMP_LE_OQ, f16);
    impl_cmp_fp16!(greater_than_or_equal, _CMP_GE_OQ, f16);

    impl_unop!(abs, _mm512_abs, f16);
    impl_unop!(recip, _mm512_rcp, f16);

    impl_reduce!(reduce_add, _mm512_reduce_add, f16);
    impl_reduce!(reduce_min, _mm512_reduce_min, f16);
    impl_reduce!(reduce_max, _mm512_reduce_max, f16);

    #[inline(always)]
    fn mul_add_f16(a: __m512, b: __m512, c: __m512) -> __m512 {
        cast!(_mm512_fmadd_ph(cast!(a), cast!(b), cast!(c)))
    }
    #[inline(always)]
    fn mul_add_f16_supported() -> bool {
        true
    }
}

pub struct V4Impl<FP16: FP16Ext>(PhantomData<FP16>);

impl<FP16: FP16Ext> Sealed for V4Impl<FP16> {}

macro_rules! delegate_fp16 {
    (cmp $($func: ident),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _f16>](a: Self::Register, b: Self::Register) -> __mmask32 {
                FP16::[<$func _f16>](a, b)
            }
            #[inline(always)]
            fn [<$func _f16_supported>]() -> bool {
                FP16::[<$func _f16_supported>]()
            }
        })*
    };
    (reduce $($func: ident),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _f16>](a: Self::Register) -> f16 {
                FP16::[<$func _f16>](a)
            }
            #[inline(always)]
            fn [<$func _f16_supported>]() -> bool {
                FP16::[<$func _f16_supported>]()
            }
        })*
    };
    ($($func: ident),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _f16>](a: Self::Register, b: Self::Register) -> Self::Register {
                FP16::[<$func _f16>](a, b)
            }
            #[inline(always)]
            fn [<$func _f16_supported>]() -> bool {
                FP16::[<$func _f16_supported>]()
            }
        })*
    };
}

macro_rules! impl_cmp {
    ($func: ident, $op: expr, $($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<$func _ $ty>](a: Self::Register, b: Self::Register) -> <$ty as Scalar>::Mask<Self> {
                cast!(with_ty_cmp!(_mm512_cmp, $ty, $op)(cast!(a), cast!(b)))
            }
            #[inline(always)]
            fn [<$func _ $ty _supported>]() -> bool {
                true
            }
        })*
    };
}

impl<FP16: FP16Ext> Simd for V4Impl<FP16>
where
    Self: V4Run,
{
    type Register = __m512;
    type Mask8 = __mmask64;
    type Mask16 = __mmask32;
    type Mask32 = __mmask16;
    type Mask64 = __mmask8;

    lanes!(8, 16, 32, 64);

    impl_binop_signless!(add, _mm512_add, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
    impl_binop_signless!(sub, _mm512_sub, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
    impl_binop!(div, _mm512_div, f32, f64);
    impl_binop!(mul, _mm512_mul, f32, f64);
    impl_binop_signless!(mul, _mm512_mullo, u16, i16, u32, i32, u64, i64);
    impl_binop!(min, _mm512_min, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
    impl_binop!(max, _mm512_max, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
    impl_binop_scalar!(mul, Mul::mul, i8, u8);

    impl_binop_untyped!(bitand, _mm512_and_si512);
    impl_binop_untyped!(bitor, _mm512_or_si512);
    impl_binop_untyped!(bitxor, _mm512_xor_si512);

    impl_cmp!(equals, _CMP_EQ_OQ, f32, f64);
    impl_cmp!(equals, _MM_CMPINT_EQ, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_cmp!(less_than, _CMP_LT_OQ, f32, f64);
    impl_cmp!(
        less_than,
        _MM_CMPINT_LT,
        u8,
        i8,
        u16,
        i16,
        u32,
        i32,
        u64,
        i64
    );
    impl_cmp!(greater_than, _CMP_GT_OQ, f32, f64);
    impl_cmp!(
        greater_than,
        _MM_CMPINT_NLE,
        u8,
        i8,
        u16,
        i16,
        u32,
        i32,
        u64,
        i64
    );
    impl_cmp!(less_than_or_equal, _CMP_LE_OQ, f32, f64);
    impl_cmp!(
        less_than_or_equal,
        _MM_CMPINT_LE,
        u8,
        i8,
        u16,
        i16,
        u32,
        i32,
        u64,
        i64
    );
    impl_cmp!(greater_than_or_equal, _CMP_GE_OQ, f32, f64);
    impl_cmp!(
        greater_than_or_equal,
        _MM_CMPINT_NLT,
        u8,
        i8,
        u16,
        i16,
        u32,
        i32,
        u64,
        i64
    );

    impl_unop!(recip, _mm512_rcp14, f32, f64);
    impl_unop!(abs, _mm512_abs, i8, i16, i32, i64, f32, f64);

    impl_reduce_signless!(reduce_add, _mm512_reduce_add, u32, i32, u64, i64, f32, f64);
    impl_reduce!(reduce_min, _mm512_reduce_min, u32, i32, u64, i64, f32, f64);
    impl_reduce!(reduce_max, _mm512_reduce_max, u32, i32, u64, i64, f32, f64);

    impl_reduce_split!(reduce_add, _mm256_reduce_add, wrapping_add, i8, i16);
    impl_reduce_split!(reduce_min, _mm256_reduce_min, min, u8, i8, u16, i16);
    impl_reduce_split!(reduce_max, _mm256_reduce_max, max, u8, i8, u16, i16);

    delegate_fp16!(add, sub, mul, div, min, max);
    delegate_fp16!(reduce reduce_add, reduce_min, reduce_max);
    delegate_fp16!(cmp equals, less_than, less_than_or_equal, greater_than_or_equal, greater_than);

    fn vectorize<Op: WithSimd>(op: Op) -> Op::Output {
        struct Impl<Op, FP16: FP16Ext> {
            op: Op,
            _fp16: PhantomData<FP16>,
        }
        impl<Op: WithSimd, FP16: FP16Ext> NullaryFnOnce for Impl<Op, FP16>
        where
            V4Impl<FP16>: V4Run,
        {
            type Output = Op::Output;

            #[inline(always)]
            fn call(self) -> Self::Output {
                self.op.with_simd::<V4Impl<FP16>>()
            }
        }
        Self::run_vectorized(Impl {
            op,
            _fp16: PhantomData,
        })
    }

    #[inline(always)]
    unsafe fn mask_store_as_bool_8(out: *mut bool, mask: Self::Mask8) {
        let mask = _mm512_maskz_set1_epi8(mask, 1);
        _mm512_storeu_si512(out as _, cast!(mask));
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_16(out: *mut bool, mask: Self::Mask16) {
        let mask = _mm256_maskz_set1_epi8(mask, 1);
        _mm256_storeu_si256(out as _, cast!(mask));
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_32(out: *mut bool, mask: Self::Mask32) {
        let mask = _mm_maskz_set1_epi8(mask, 1);
        _mm_storeu_si128(out as _, cast!(mask));
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_64(out: *mut bool, mask: Self::Mask64) {
        let mask = _mm_maskz_set1_epi8(mask as Self::Mask32, 1);
        _mm_storel_epi64(out as _, cast!(mask));
    }
    #[inline(always)]
    fn mask_from_bools_8(bools: &[bool]) -> Self::Mask8 {
        const LANES: usize = WIDTH / 8;
        let bools: [bool; LANES] = bools.try_into().expect("Incorrect bools length");
        let true_ = unsafe { _mm512_set1_epi8(1) };
        unsafe { _mm512_cmp_epu8_mask::<_MM_CMPINT_EQ>(cast!(bools), true_) }
    }
    #[inline(always)]
    fn mask_from_bools_16(bools: &[bool]) -> Self::Mask16 {
        const LANES: usize = WIDTH / 16;
        let bools: [bool; LANES] = bools.try_into().expect("Incorrect bools length");
        let true_ = unsafe { _mm256_set1_epi8(1) };
        unsafe { _mm256_cmp_epu8_mask::<_MM_CMPINT_EQ>(cast!(bools), true_) }
    }
    #[inline(always)]
    fn mask_from_bools_32(bools: &[bool]) -> Self::Mask32 {
        const LANES: usize = WIDTH / 32;
        let bools: [bool; LANES] = bools.try_into().expect("Incorrect bools length");
        let true_ = unsafe { _mm_set1_epi8(1) };
        unsafe { _mm_cmp_epu8_mask::<_MM_CMPINT_EQ>(cast!(bools), true_) }
    }
    #[inline(always)]
    fn mask_from_bools_64(bools: &[bool]) -> Self::Mask64 {
        const LANES: usize = WIDTH / 64;
        let bools: [bool; LANES] = bools.try_into().expect("Incorrect bools length");
        let bools = unsafe { _mm_set1_epi64x(cast!(bools)) };
        let true_ = unsafe { _mm_set1_epi8(1) };
        unsafe { _mm_cmp_epu8_mask::<_MM_CMPINT_EQ>(bools, true_) as Self::Mask64 }
    }
    #[inline(always)]
    unsafe fn load<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        cast!(_mm512_load_si512(ptr as _))
    }
    #[inline(always)]
    unsafe fn load_unaligned<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        cast!(_mm512_loadu_si512(ptr as _))
    }
    #[inline(always)]
    unsafe fn load_low<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        let lo = _mm256_lddqu_si256(ptr as _);
        cast!(_mm512_castsi256_si512(lo))
    }
    #[inline(always)]
    unsafe fn load_high<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        let ptr = ptr as *const __m256i;
        let hi = _mm256_lddqu_si256(ptr.add(1));
        cast!(_mm512_inserti64x4::<1>(cast!(Self::splat_u64(0)), hi))
    }
    #[inline(always)]
    unsafe fn store<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        _mm512_store_si512(ptr as _, cast!(value));
    }
    #[inline(always)]
    unsafe fn store_unaligned<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        _mm512_storeu_si512(ptr as _, cast!(value));
    }
    #[inline(always)]
    unsafe fn store_low<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        let lo = _mm512_castsi512_si256(cast!(value));
        _mm256_storeu_si256(ptr as _, lo);
    }
    #[inline(always)]
    unsafe fn store_high<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        let hi = _mm512_extracti64x4_epi64::<1>(cast!(value));
        let ptr = ptr as *mut __m256i;
        _mm256_storeu_si256(ptr.add(1), hi);
    }
    #[inline(always)]
    fn splat_i8(value: i8) -> Self::Register {
        cast!(_mm512_set1_epi8(value))
    }
    #[inline(always)]
    fn splat_i16(value: i16) -> Self::Register {
        cast!(_mm512_set1_epi16(value))
    }
    #[inline(always)]
    fn splat_i32(value: i32) -> Self::Register {
        cast!(_mm512_set1_epi32(value))
    }
    #[inline(always)]
    fn splat_i64(value: i64) -> Self::Register {
        cast!(_mm512_set1_epi64(value))
    }
    #[inline(always)]
    fn bitnot(a: Self::Register) -> Self::Register {
        Self::bitxor(a, Self::splat_i64(-1))
    }
    #[inline(always)]
    fn bitnot_supported() -> bool {
        true
    }
    #[inline(always)]
    fn mul_add_f16(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        FP16::mul_add_f16(a, b, c)
    }
    #[inline(always)]
    fn mul_add_f16_supported() -> bool {
        FP16::mul_add_f16_supported()
    }
    #[inline(always)]
    fn mul_add_f32(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        unsafe { _mm512_fmadd_ps(a, b, c) }
    }
    #[inline(always)]
    fn mul_add_f32_supported() -> bool {
        true
    }
    #[inline(always)]
    fn mul_add_f64(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        cast!(_mm512_fmadd_pd(cast!(a), cast!(b), cast!(c)))
    }
    #[inline(always)]
    fn mul_add_f64_supported() -> bool {
        true
    }
    #[inline(always)]
    fn recip_f16(a: Self::Register) -> Self::Register {
        FP16::recip_f16(a)
    }
    #[inline(always)]
    fn recip_f16_supported() -> bool {
        FP16::recip_f16_supported()
    }
    #[inline(always)]
    fn abs_f16(a: Self::Register) -> Self::Register {
        FP16::abs_f16(a)
    }
    #[inline(always)]
    fn abs_f16_supported() -> bool {
        FP16::abs_f16_supported()
    }

    fn reduce_add_u8(a: Self::Register) -> u8 {
        Self::reduce_add_i8(a) as u8
    }

    fn reduce_add_u8_supported() -> bool {
        Self::reduce_add_i8_supported()
    }

    fn reduce_add_u16(a: Self::Register) -> u16 {
        Self::reduce_add_i16(a) as u16
    }

    fn reduce_add_u16_supported() -> bool {
        Self::reduce_add_i16_supported()
    }
}

trait V4Run {
    fn run_vectorized<F: NullaryFnOnce>(f: F) -> F::Output;
}

impl V4Run for V4 {
    #[inline(always)]
    fn run_vectorized<F: NullaryFnOnce>(f: F) -> F::Output {
        V4::run_vectorized(f)
    }
}

#[cfg(feature = "fp16")]
impl V4Run for V4FP16 {
    #[inline(always)]
    fn run_vectorized<F: NullaryFnOnce>(f: F) -> F::Output {
        V4FP16::run_vectorized(f)
    }
}

impl V4 {
    impl_simd!(
        "sse", "sse2", "fxsr", "sse3", "ssse3", "sse4.1", "sse4.2", "popcnt", "avx", "avx2",
        "f16c", "bmi1", "bmi2", "fma", "lzcnt", "avx512f", "avx512bw", "avx512cd", "avx512dq",
        "avx512vl"
    );
}

#[cfg(feature = "fp16")]
impl V4FP16 {
    impl_simd!(
        "sse",
        "sse2",
        "fxsr",
        "sse3",
        "ssse3",
        "sse4.1",
        "sse4.2",
        "popcnt",
        "avx",
        "avx2",
        "bmi1",
        "bmi2",
        "fma",
        "lzcnt",
        "avx512f",
        "avx512bw",
        "avx512cd",
        "avx512dq",
        "avx512vl",
        "avx512fp16"
    );
}
