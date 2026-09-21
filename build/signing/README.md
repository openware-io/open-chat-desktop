# Local Apple signing assets

Place the following machine-local provisioning profiles in this directory:

- `mac_app_store.provisionprofile`: Mac App Store distribution profile for `com.csmimtbshop.com`.
- `mac_development.provisionprofile`: macOS App Development profile for `com.csmimtbshop.com`, used only by `pnpm build:mas-dev`.

Provisioning profiles, certificates, certificate requests, and private keys in this directory are ignored by Git and must not be committed.
