use bytemuck::{Pod, Zeroable};
use core::{arch::loongarch64::*, ptr::read_unaligned};
use core::{
    ops::{Add, Div, Mul, Sub},
    ptr::write_unaligned,
};

use half::f16;
use num_traits::Float;
use paste::paste;

use crate::{backend::arch::NullaryFnOnce, impl_cmp_scalar, Scalar, WithSimd};

use crate::backend::{arch::impl_simd, cast, seal::Sealed, Simd, VRegister, Vector};

use super::*;

/// Newtype to implement `Pod` since bytemuck doesn't support loongarch64 SIMD
/// types
#[repr(transparent)]
#[derive(Debug, Clone, Copy)]
pub struct Register(v4f32);

unsafe impl Pod for Register {}
unsafe impl Zeroable for Register {}

impl VRegister for Register {}

const WIDTH: usize = size_of::<<Lsx as Simd>::Register>() * 8;

pub struct Lsx;

impl Sealed for Lsx {}

macro_rules! cmp_int {
    ($($ty: ty),*) => {
        $(paste! {
            #[inline(always)]
            fn [<greater_than_ $ty>](
                a: Self::Register,
                b: Self::Register,
            ) -> <$ty as Scalar>::Mask<Self> {
                Self::[<less_than_ $ty>](b, a)
            }
            #[inline(always)]
            fn [<greater_than_ $ty _supported>]() -> bool {
                Self::[<less_than_ $ty _supported>]()
            }
            #[inline(always)]
            fn [<greater_than_or_equal_ $ty>](
                a: Self::Register,
                b: Self::Register,
            ) -> <$ty as Scalar>::Mask<Self> {
                let gt = Self::[<less_than_ $ty>](a, b);
                cast!(Self::bitnot(cast!(gt)))
            }
            #[inline(always)]
            fn [<greater_than_or_equal_ $ty _supported>]() -> bool {
                Self::[<less_than_ $ty _supported>]()
            }
        })*
    };
}

impl Simd for Lsx {
    type Register = Register;
    type Mask8 = Vector<Self, i8>;
    type Mask16 = Vector<Self, i16>;
    type Mask32 = Vector<Self, i32>;
    type Mask64 = Vector<Self, i64>;

    lanes!(8, 16, 32, 64);

    impl_binop_signless!(add, lsx_vadd, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_binop_signless!(add, lsx_vfadd, f32, f64);
    impl_binop_signless!(sub, lsx_vsub, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_binop_signless!(sub, lsx_vfsub, f32, f64);
    impl_binop!(div, lsx_vfdiv, f32, f64);
    impl_binop_signless!(mul, lsx_vmul, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_binop_signless!(mul, lsx_vfmul, f32, f64);
    impl_binop!(min, lsx_vmin, u8, i8, u16, i16, u32, i32, i64, u64);
    impl_binop!(min, lsx_vfmin, f32, f64);
    impl_binop!(max, lsx_vmax, u8, i8, u16, i16, u32, i32, i64, u64);
    impl_binop!(max, lsx_vfmax, f32, f64);

    impl_binop_scalar!(add, Add::add, f16);
    impl_binop_scalar!(sub, Sub::sub, f16);
    impl_binop_scalar!(div, Div::div, f16);
    impl_binop_scalar!(mul, Mul::mul, f16);
    impl_binop_scalar!(min, f16::min, f16);
    impl_binop_scalar!(max, f16::max, f16);

    impl_binop_untyped!(bitand, lsx_vand_v);
    impl_binop_untyped!(bitor, lsx_vor_v);
    impl_binop_untyped!(bitxor, lsx_vxor_v);

    impl_unop!(recip, lsx_vfrecip, f32, f64);
    impl_unop_scalar!(recip, recip, f16);

    impl_cmp_signless!(equals, lsx_vseq, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_cmp_signless!(equals, lsx_vfcmp_ceq, f32, f64);
    impl_cmp_signless!(less_than, lsx_vfcmp_clt, f32, f64);
    impl_cmp_signless!(less_than_or_equal, lsx_vfcmp_cle, f32, f64);
    impl_cmp!(less_than, lsx_vslt, u8, i8, u16, i16, u32, i32, u64, i64);
    impl_cmp!(
        less_than_or_equal,
        lsx_vsle,
        u8,
        i8,
        u16,
        i16,
        u32,
        i32,
        u64,
        i64
    );
    cmp_int!(u8, i8, u16, i16, u32, i32, u64, i64);

    impl_cmp_scalar!(equals, eq, f16: i16);
    impl_cmp_scalar!(greater_than, gt, f16: i16);
    impl_cmp_scalar!(greater_than_or_equal, ge, f16: i16);
    impl_cmp_scalar!(less_than, lt, f16: i16);
    impl_cmp_scalar!(less_than_or_equal, le, f16: i16);

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
                self.op.with_simd::<Lsx>()
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
        const LANES: usize = WIDTH / 16;
        let mask: [i16; LANES] = cast!(mask);
        for i in 0..LANES {
            *out.add(i) = mask[i] != 0;
        }
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_32(out: *mut bool, mask: Self::Mask32) {
        const LANES: usize = WIDTH / 32;
        let mask: [i32; LANES] = cast!(mask);
        for i in 0..LANES {
            *out.add(i) = mask[i] != 0;
        }
    }
    #[inline(always)]
    unsafe fn mask_store_as_bool_64(out: *mut bool, mask: Self::Mask64) {
        const LANES: usize = WIDTH / 64;
        let mask: [i64; LANES] = cast!(mask);
        for i in 0..LANES {
            *out.add(i) = mask[i] != 0;
        }
    }
    #[inline(always)]
    fn mask_from_bools_8(bools: &[bool]) -> Self::Mask8 {
        debug_assert_eq!(bools.len(), Self::lanes8());
        const LANES: usize = WIDTH / 8;
        let mut out = [0i8; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }
    #[inline(always)]
    fn mask_from_bools_16(bools: &[bool]) -> Self::Mask16 {
        debug_assert_eq!(bools.len(), Self::lanes16());
        const LANES: usize = WIDTH / 16;
        let mut out = [0i16; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }
    #[inline(always)]
    fn mask_from_bools_32(bools: &[bool]) -> Self::Mask32 {
        debug_assert_eq!(bools.len(), Self::lanes32());
        const LANES: usize = WIDTH / 32;
        let mut out = [0i32; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }
    #[inline(always)]
    fn mask_from_bools_64(bools: &[bool]) -> Self::Mask64 {
        debug_assert_eq!(bools.len(), Self::lanes64());
        const LANES: usize = WIDTH / 64;
        let mut out = [0i64; LANES];
        for i in 0..LANES {
            out[i] = if bools[i] { -1 } else { 0 };
        }
        cast!(out)
    }

    #[inline(always)]
    unsafe fn load<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        cast!(lsx_vld::<0>(ptr as _))
    }
    #[inline(always)]
    unsafe fn load_unaligned<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        cast!(lsx_vld::<0>(ptr as _))
    }
    #[inline(always)]
    unsafe fn load_low<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        // Hopefully the compiler can optimize this. `asm` doesn't support vreg on
        // loongarch64, so we can't force a reinterpretation.
        let low = unsafe { read_unaligned(ptr as *const f64) };
        cast!(read_unaligned(&low as *const f64 as *const v16i8))
    }
    #[inline(always)]
    unsafe fn load_high<T: Scalar>(ptr: *const T) -> Vector<Self, T> {
        // Hopefully the compiler can optimize this. `asm` doesn't support vreg on
        // loongarch64, so we can't force a reinterpretation.
        let high = unsafe { read_unaligned((ptr as *const f64).add(1)) };
        let full = read_unaligned(&high as *const f64 as *const v4i32);
        cast!(lsx_vpermi_w::<0b11110000>(full, cast!(Register::zeroed())))
    }
    #[inline(always)]
    unsafe fn store<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        unsafe { lsx_vst::<0>(cast!(*value), ptr as _) };
    }
    #[inline(always)]
    unsafe fn store_unaligned<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        unsafe { lsx_vst::<0>(cast!(*value), ptr as _) };
    }
    #[inline(always)]
    unsafe fn store_low<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        let low = lsx_vpickve2gr_d::<0>(cast!(value));
        unsafe {
            write_unaligned(ptr as _, low);
        };
    }
    #[inline(always)]
    unsafe fn store_high<T: Scalar>(ptr: *mut T, value: Vector<Self, T>) {
        let high = lsx_vpickve2gr_d::<1>(cast!(value));
        unsafe {
            write_unaligned(ptr as _, high);
        };
    }

    #[inline(always)]
    fn splat_i8(value: i8) -> Self::Register {
        cast!(lsx_vreplgr2vr_b(value as i32))
    }

    #[inline(always)]
    fn splat_i16(value: i16) -> Self::Register {
        cast!(lsx_vreplgr2vr_h(value as i32))
    }

    #[inline(always)]
    fn splat_i32(value: i32) -> Self::Register {
        cast!(lsx_vreplgr2vr_w(value))
    }

    #[inline(always)]
    fn splat_i64(value: i64) -> Self::Register {
        cast!(lsx_vreplgr2vr_d(value))
    }

    #[inline(always)]
    fn mul_add_f16(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        let a: [f16; 8] = cast!(a);
        let b: [f16; 8] = cast!(b);
        let c: [f16; 8] = cast!(c);
        let mut out = [f16::default(); 8];

        for i in 0..8 {
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
        let temp = Self::mul_f32(a, b);
        cast!(Self::add_f32(temp, c))
    }
    #[inline(always)]
    fn mul_add_f32_supported() -> bool {
        true
    }
    #[inline(always)]
    fn mul_add_f64(a: Self::Register, b: Self::Register, c: Self::Register) -> Self::Register {
        let temp = Self::mul_f64(a, b);
        cast!(Self::add_f64(temp, c))
    }
    #[inline(always)]
    fn mul_add_f64_supported() -> bool {
        true
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
    fn abs_f16(a: Self::Register) -> Self::Register {
        let mask = Self::splat_i16(i16::MAX);
        Self::bitand(a, mask)
    }
    #[inline(always)]
    fn abs_f16_supported() -> bool {
        true
    }
    #[inline(always)]
    fn abs_f32(a: Self::Register) -> Self::Register {
        let mask = Self::splat_i32(i32::MAX);
        Self::bitand(a, mask)
    }
    #[inline(always)]
    fn abs_f32_supported() -> bool {
        true
    }
    #[inline(always)]
    fn abs_f64(a: Self::Register) -> Self::Register {
        let mask = Self::splat_i64(i64::MAX);
        Self::bitand(a, mask)
    }
    #[inline(always)]
    fn abs_f64_supported() -> bool {
        true
    }
    #[inline(always)]
    fn abs_i64(a: Self::Register) -> Self::Register {
        let mask = Self::splat_i64(i64::MAX);
        Self::bitand(a, mask)
    }
    #[inline(always)]
    fn abs_i64_supported() -> bool {
        true
    }
    #[inline(always)]
    fn greater_than_f32(a: Self::Register, b: Self::Register) -> <f32 as Scalar>::Mask<Self> {
        Self::less_than_f32(b, a)
    }
    #[inline(always)]
    fn greater_than_f32_supported() -> bool {
        Self::less_than_f32_supported()
    }
    #[inline(always)]
    fn greater_than_f64(a: Self::Register, b: Self::Register) -> <f64 as Scalar>::Mask<Self> {
        Self::less_than_f64(b, a)
    }
    #[inline(always)]
    fn greater_than_f64_supported() -> bool {
        Self::less_than_f64_supported()
    }
    #[inline(always)]
    fn greater_than_or_equal_f32(
        a: Self::Register,
        b: Self::Register,
    ) -> <f32 as Scalar>::Mask<Self> {
        Self::less_than_or_equal_f32(b, a)
    }
    #[inline(always)]
    fn greater_than_or_equal_f32_supported() -> bool {
        Self::less_than_or_equal_f32_supported()
    }
    #[inline(always)]
    fn greater_than_or_equal_f64(
        a: Self::Register,
        b: Self::Register,
    ) -> <f64 as Scalar>::Mask<Self> {
        Self::less_than_or_equal_f64(b, a)
    }
    #[inline(always)]
    fn greater_than_or_equal_f64_supported() -> bool {
        Self::less_than_or_equal_f64_supported()
    }
    #[inline(always)]
    fn abs_i8(a: Self::Register) -> Self::Register {
        cast!(lsx_vsigncov_b(cast!(a), cast!(a)))
    }
    #[inline(always)]
    fn abs_i8_supported() -> bool {
        true
    }
    #[inline(always)]
    fn abs_i16(a: Self::Register) -> Self::Register {
        cast!(lsx_vsigncov_h(cast!(a), cast!(a)))
    }
    #[inline(always)]
    fn abs_i16_supported() -> bool {
        true
    }
    #[inline(always)]
    fn abs_i32(a: Self::Register) -> Self::Register {
        cast!(lsx_vsigncov_w(cast!(a), cast!(a)))
    }
    #[inline(always)]
    fn abs_i32_supported() -> bool {
        true
    }
}

impl Lsx {
    impl_simd!("lsx", "lasx");
}
