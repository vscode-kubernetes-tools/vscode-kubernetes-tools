# Loopback HTTPS fixtures

These certificates and the test-only private server key are used only by the Kubernetes client tests on `127.0.0.1`. Never use them outside tests.

The private test CA signs the server certificate, which is valid for `127.0.0.1` and `localhost` until April 2054. The CA private key is not included.
