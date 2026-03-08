use axum::http::{header, HeaderMap};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthContext {
    pub user_id: String,
    pub email: Option<String>,
    pub org_id: Option<String>,
    pub roles: Vec<String>,
    pub claims: Value,
    pub issuer_ok: bool,
    pub aud_ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhoAmIOrg {
    pub org_id: String,
    pub role: String,
    pub apps: Vec<String>,
}

#[derive(Debug, Clone)]
struct JwksCache {
    keys: Vec<Jwk>,
    fetched_at_epoch: i64,
}

#[derive(Debug, Clone, Deserialize)]
struct JwkSet {
    keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Deserialize)]
struct Jwk {
    kid: Option<String>,
    n: Option<String>,
    e: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MembershipRow {
    org_id: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct OrgAppRow {
    app_id: String,
}

static JWKS_CACHE: Lazy<RwLock<Option<JwksCache>>> = Lazy::new(|| RwLock::new(None));

fn env_first(keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|k| std::env::var(k).ok())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn expected_issuer() -> Option<String> {
    env_first(&["SUPABASE_JWT_ISSUER", "SUPABASE_ISSUER"])
}

fn expected_audience() -> Option<String> {
    env_first(&["SUPABASE_JWT_AUDIENCE", "SUPABASE_AUDIENCE"])
}

fn jwks_url() -> Option<String> {
    if let Some(url) = env_first(&["SUPABASE_JWKS_URL"]) {
        return Some(url);
    }
    env_first(&["SUPABASE_URL"]).map(|base| {
        format!(
            "{}/auth/v1/.well-known/jwks.json",
            base.trim_end_matches('/')
        )
    })
}

fn app_id() -> String {
    env_first(&["KLYTICS_APP_ID"]).unwrap_or_else(|| "cerniq".to_string())
}

fn require_org() -> bool {
    env_first(&["KLYTICS_REQUIRE_ORG"])
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn require_entitlement() -> bool {
    env_first(&["KLYTICS_REQUIRE_ENTITLEMENT"])
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn get_bearer_token(headers: &HeaderMap) -> Result<String, AppError> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .ok_or_else(|| AppError::Auth("Missing authorization header".to_string()))?;

    let auth_str = auth_header
        .to_str()
        .map_err(|_| AppError::Auth("Invalid authorization header".to_string()))?;

    auth_str
        .strip_prefix("Bearer ")
        .or_else(|| auth_str.strip_prefix("bearer "))
        .map(|t| t.to_string())
        .ok_or_else(|| AppError::Auth("Authorization header must use Bearer token".to_string()))
}

fn get_claim_string(claims: &Value, key: &str) -> Option<String> {
    claims.get(key)?.as_str().map(|v| v.to_string())
}

fn audience_matches(claims: &Value, expected: Option<&str>) -> bool {
    let Some(expected_aud) = expected else {
        return true;
    };
    match claims.get("aud") {
        Some(Value::String(s)) => s == expected_aud,
        Some(Value::Array(items)) => items.iter().any(|v| v.as_str() == Some(expected_aud)),
        _ => false,
    }
}

fn issuer_matches(claims: &Value, expected: Option<&str>) -> bool {
    let Some(expected_iss) = expected else {
        return true;
    };
    claims
        .get("iss")
        .and_then(|v| v.as_str())
        .map(|iss| iss == expected_iss)
        .unwrap_or(false)
}

async fn fetch_jwks_keys() -> Result<Vec<Jwk>, AppError> {
    let Some(url) = jwks_url() else {
        return Err(AppError::Auth(
            "Supabase JWKS URL is not configured".to_string(),
        ));
    };

    let now = chrono::Utc::now().timestamp();
    let ttl_seconds = env_first(&["SUPABASE_JWKS_CACHE_TTL"])
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(600);

    {
        let guard = JWKS_CACHE.read().await;
        if let Some(cache) = guard.as_ref() {
            if now - cache.fetched_at_epoch < ttl_seconds {
                return Ok(cache.keys.clone());
            }
        }
    }

    let keys = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to fetch Supabase JWKS: {}", e)))?
        .error_for_status()
        .map_err(|e| AppError::Auth(format!("Supabase JWKS returned error: {}", e)))?
        .json::<JwkSet>()
        .await
        .map_err(|e| AppError::Auth(format!("Invalid Supabase JWKS payload: {}", e)))?
        .keys;

    let mut guard = JWKS_CACHE.write().await;
    *guard = Some(JwksCache {
        keys: keys.clone(),
        fetched_at_epoch: now,
    });

    Ok(keys)
}

async fn decode_supabase_claims(token: &str, jwt_secret: &str) -> Result<Value, AppError> {
    let issuer = expected_issuer();
    let audience = expected_audience();

    if jwks_url().is_some() {
        let header = decode_header(token)
            .map_err(|_| AppError::Auth("Unable to decode token header".to_string()))?;
        let kid = header
            .kid
            .ok_or_else(|| AppError::Auth("Missing token kid".to_string()))?;

        let keys = fetch_jwks_keys().await?;
        let key = keys
            .into_iter()
            .find(|k| k.kid.as_deref() == Some(kid.as_str()))
            .ok_or_else(|| AppError::Auth("Unknown token signing key".to_string()))?;

        let n = key
            .n
            .ok_or_else(|| AppError::Auth("JWKS key missing modulus".to_string()))?;
        let e = key
            .e
            .ok_or_else(|| AppError::Auth("JWKS key missing exponent".to_string()))?;
        let decoding_key = DecodingKey::from_rsa_components(&n, &e)
            .map_err(|_| AppError::Auth("Invalid JWKS RSA key".to_string()))?;

        let mut validation = Validation::new(Algorithm::RS256);
        if let Some(aud) = audience.as_deref() {
            validation.set_audience(&[aud]);
        } else {
            validation.validate_aud = false;
        }
        if let Some(iss) = issuer.as_deref() {
            validation.set_issuer(&[iss]);
        }

        return decode::<Value>(token, &decoding_key, &validation)
            .map(|d| d.claims)
            .map_err(|_| AppError::Auth("Invalid or expired token".to_string()));
    }

    let mut validation = Validation::new(Algorithm::HS256);
    if let Some(aud) = audience.as_deref() {
        validation.set_audience(&[aud]);
    } else {
        validation.validate_aud = false;
    }
    if let Some(iss) = issuer.as_deref() {
        validation.set_issuer(&[iss]);
    }

    decode::<Value>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &validation,
    )
    .map(|d| d.claims)
    .map_err(|_| AppError::Auth("Invalid or expired token".to_string()))
}

async fn enforce_membership_and_entitlement(ctx: &AuthContext) -> Result<(), AppError> {
    if !require_org() && !require_entitlement() {
        return Ok(());
    }

    let org_id = ctx
        .org_id
        .as_deref()
        .ok_or_else(|| AppError::Forbidden("Organization context is required".to_string()))?;

    let supabase_url = env_first(&["SUPABASE_URL"]).ok_or_else(|| {
        AppError::Forbidden("SUPABASE_URL is required for org enforcement".to_string())
    })?;
    let service_role = env_first(&["SUPABASE_SERVICE_ROLE_KEY"]).ok_or_else(|| {
        AppError::Forbidden("SUPABASE_SERVICE_ROLE_KEY is required for org enforcement".to_string())
    })?;

    let base = supabase_url.trim_end_matches('/');
    let client = reqwest::Client::new();

    let membership_url = format!(
        "{}/rest/v1/memberships?select=org_id,role&org_id=eq.{}&user_id=eq.{}",
        base, org_id, ctx.user_id
    );
    let memberships: Vec<MembershipRow> = client
        .get(membership_url)
        .header("apikey", &service_role)
        .header("Authorization", format!("Bearer {}", service_role))
        .send()
        .await
        .map_err(|e| AppError::Forbidden(format!("Membership check failed: {}", e)))?
        .error_for_status()
        .map_err(|e| AppError::Forbidden(format!("Membership check failed: {}", e)))?
        .json()
        .await
        .map_err(|e| AppError::Forbidden(format!("Membership check payload failed: {}", e)))?;

    if memberships.is_empty() {
        return Err(AppError::Forbidden(
            "User is not a member of the selected organization".to_string(),
        ));
    }

    if require_entitlement() {
        let entitlement_url = format!(
            "{}/rest/v1/org_apps?select=app_id&org_id=eq.{}&app_id=eq.{}&enabled=is.true",
            base,
            org_id,
            app_id()
        );
        let entitlements: Vec<OrgAppRow> = client
            .get(entitlement_url)
            .header("apikey", &service_role)
            .header("Authorization", format!("Bearer {}", service_role))
            .send()
            .await
            .map_err(|e| AppError::Forbidden(format!("Entitlement check failed: {}", e)))?
            .error_for_status()
            .map_err(|e| AppError::Forbidden(format!("Entitlement check failed: {}", e)))?
            .json()
            .await
            .map_err(|e| AppError::Forbidden(format!("Entitlement payload failed: {}", e)))?;

        if entitlements.is_empty() {
            return Err(AppError::Forbidden(
                "Organization is not entitled for this app".to_string(),
            ));
        }
    }

    Ok(())
}

pub async fn verify_request(
    headers: &HeaderMap,
    jwt_secret: &str,
) -> Result<AuthContext, AppError> {
    let token = get_bearer_token(headers)?;
    let claims = decode_supabase_claims(&token, jwt_secret).await?;

    let user_id = get_claim_string(&claims, "sub")
        .ok_or_else(|| AppError::Auth("Token missing subject".to_string()))?;
    Uuid::parse_str(&user_id)
        .map_err(|_| AppError::Auth("Token subject is not a valid UUID".to_string()))?;

    let org_id = get_claim_string(&claims, "org_id").or_else(|| {
        headers
            .get("x-klytics-org-id")
            .and_then(|v| v.to_str().ok())
            .map(|v| v.to_string())
    });

    let roles = claims
        .get("roles")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .or_else(|| get_claim_string(&claims, "role").map(|r| vec![r]))
        .unwrap_or_default();

    let ctx = AuthContext {
        user_id,
        email: get_claim_string(&claims, "email"),
        org_id,
        roles,
        issuer_ok: issuer_matches(&claims, expected_issuer().as_deref()),
        aud_ok: audience_matches(&claims, expected_audience().as_deref()),
        claims,
    };

    enforce_membership_and_entitlement(&ctx).await?;
    Ok(ctx)
}

pub async fn fetch_user_orgs(user_id: &str) -> Result<Vec<WhoAmIOrg>, AppError> {
    let supabase_url = match env_first(&["SUPABASE_URL"]) {
        Some(v) => v,
        None => return Ok(Vec::new()),
    };
    let service_role = match env_first(&["SUPABASE_SERVICE_ROLE_KEY"]) {
        Some(v) => v,
        None => return Ok(Vec::new()),
    };
    let base = supabase_url.trim_end_matches('/');

    let client = reqwest::Client::new();
    let membership_url = format!(
        "{}/rest/v1/memberships?select=org_id,role&user_id=eq.{}",
        base, user_id
    );
    let memberships: Vec<MembershipRow> = client
        .get(membership_url)
        .header("apikey", &service_role)
        .header("Authorization", format!("Bearer {}", service_role))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read memberships: {}", e)))?
        .error_for_status()
        .map_err(|e| AppError::Internal(format!("Failed to read memberships: {}", e)))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Invalid memberships payload: {}", e)))?;

    let mut out = Vec::new();
    for m in memberships {
        let org_apps_url = format!(
            "{}/rest/v1/org_apps?select=app_id&org_id=eq.{}&enabled=is.true",
            base, m.org_id
        );
        let apps: Vec<OrgAppRow> = client
            .get(org_apps_url)
            .header("apikey", &service_role)
            .header("Authorization", format!("Bearer {}", service_role))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read org apps: {}", e)))?
            .error_for_status()
            .map_err(|e| AppError::Internal(format!("Failed to read org apps: {}", e)))?
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Invalid org apps payload: {}", e)))?;

        out.push(WhoAmIOrg {
            org_id: m.org_id,
            role: m.role,
            apps: apps.into_iter().map(|a| a.app_id).collect(),
        });
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{header::AUTHORIZATION, HeaderValue};
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde_json::json;

    fn setup_env() {
        std::env::remove_var("SUPABASE_JWKS_URL");
        std::env::set_var("SUPABASE_JWT_SECRET", "test-secret");
        std::env::set_var("SUPABASE_JWT_ISSUER", "https://issuer.example/auth/v1");
        std::env::set_var("SUPABASE_JWT_AUDIENCE", "authenticated");
    }

    fn build_token(iss: &str, aud: &str) -> String {
        let claims = json!({
            "sub": "00000000-0000-0000-0000-000000000001",
            "email": "user@example.com",
            "iss": iss,
            "aud": aud,
            "exp": (chrono::Utc::now().timestamp() + 3600),
            "iat": chrono::Utc::now().timestamp()
        });
        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("test-secret".as_bytes()),
        )
        .expect("encode token")
    }

    fn auth_headers(token: &str, org_id: Option<&str>) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token)).expect("header value"),
        );
        if let Some(org_id) = org_id {
            headers.insert(
                "x-klytics-org-id",
                HeaderValue::from_str(org_id).expect("org header"),
            );
        }
        headers
    }

    #[tokio::test]
    async fn decodes_valid_hs256_token() {
        setup_env();
        let token = build_token("https://issuer.example/auth/v1", "authenticated");
        let decoded = decode_supabase_claims(&token, "test-secret");
        assert!(decoded.await.is_ok());
    }

    #[tokio::test]
    async fn rejects_wrong_issuer() {
        setup_env();
        let token = build_token("https://wrong.example/auth/v1", "authenticated");
        let decoded = decode_supabase_claims(&token, "test-secret");
        assert!(decoded.await.is_err());
    }

    #[tokio::test]
    async fn rejects_wrong_audience() {
        setup_env();
        let token = build_token("https://issuer.example/auth/v1", "wrong-audience");
        let decoded = decode_supabase_claims(&token, "test-secret");
        assert!(decoded.await.is_err());
    }

    #[tokio::test]
    async fn verify_request_uses_header_org_context_when_claim_missing() {
        setup_env();
        std::env::remove_var("KLYTICS_REQUIRE_ORG");
        std::env::remove_var("KLYTICS_REQUIRE_ENTITLEMENT");

        let token = build_token("https://issuer.example/auth/v1", "authenticated");
        let headers = auth_headers(&token, Some("org-from-header"));

        let ctx = verify_request(&headers, "test-secret")
            .await
            .expect("verify request");

        assert_eq!(ctx.org_id.as_deref(), Some("org-from-header"));
    }

    #[tokio::test]
    async fn verify_request_requires_org_context_when_enabled() {
        setup_env();
        std::env::set_var("KLYTICS_REQUIRE_ORG", "true");
        std::env::set_var("KLYTICS_REQUIRE_ENTITLEMENT", "false");

        let token = build_token("https://issuer.example/auth/v1", "authenticated");
        let headers = auth_headers(&token, None);

        let result = verify_request(&headers, "test-secret").await;
        assert!(matches!(result, Err(AppError::Forbidden(_))));
    }
}
