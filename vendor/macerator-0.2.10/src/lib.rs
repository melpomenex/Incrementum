#![cfg_attr(not(feature = "std"), no_std)]
#![cfg_attr(avx512_nightly, feature(avx512_target_feature, stdarch_x86_avx512))]
#![cfg_attr(fp16, feature(stdarch_x86_avx512_f16))]
#![cfg_attr(
    loong64,
    feature(stdarch_loongarch, stdarch_loongarch_feature_detection)
)]

mod arithmetic;
pub(crate) mod backend;
mod base;
mod bitwise;
mod ord;
mod reduce;
mod unary;

#[cfg(test)]
mod tests;

pub use arithmetic::*;
pub use backend::*;
pub use base::*;
pub use bitwise::*;
pub use ord::*;
pub use reduce::*;
pub use unary::*;

pub use macerator_macros::*;
