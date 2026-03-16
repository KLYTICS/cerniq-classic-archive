use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::env;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // User ID
    pub exp: usize,  // Expiration time
    pub iat: usize,  // Issued at
    pub aud: Option<String>,
    pub iss: Option<String>,
}

pub fn create_jwt(
    user_id: Uuid,
    secret: &str,
    expiration_hours: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(expiration_hours))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration as usize,
        iat: Utc::now().timestamp() as usize,
        aud: env::var("SUPABASE_AUDIENCE")
            .ok()
            .filter(|v| !v.trim().is_empty()),
        iss: env::var("SUPABASE_ISSUER")
            .ok()
            .filter(|v| !v.trim().is_empty()),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}

pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::default();
    if let Ok(audience) = env::var("SUPABASE_AUDIENCE") {
        if !audience.trim().is_empty() {
            validation.set_audience(&[audience.as_str()]);
        }
    }
    if let Ok(issuer) = env::var("SUPABASE_ISSUER") {
        if !issuer.trim().is_empty() {
            validation.set_issuer(&[issuer.as_str()]);
        }
    }
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &validation,
    )?;

    Ok(token_data.claims)
}
