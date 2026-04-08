# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e8]: C
      - heading "CERNIQ Portal" [level=1] [ref=e9]
      - paragraph [ref=e10]: Asset Liability Management
    - generic [ref=e11]:
      - heading "Sign in" [level=2] [ref=e12]
      - paragraph [ref=e13]: Enter your email to receive a secure login link.
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]: Email address
          - generic [ref=e17]:
            - img [ref=e18]
            - textbox "Email address" [ref=e21]:
              - /placeholder: cfo@institution.com
        - button "Send Login Link" [disabled] [ref=e22]
    - link "Back to home" [ref=e24] [cursor=pointer]:
      - /url: /
      - img [ref=e25]
      - text: Back to home
  - button "Open Next.js Dev Tools" [ref=e32] [cursor=pointer]:
    - img [ref=e33]
  - alert [ref=e36]: Portal Login — CERNIQ
```