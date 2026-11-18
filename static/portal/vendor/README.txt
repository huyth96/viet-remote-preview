Vendored front-end libraries for the public site (portal). Self-hosted: no CDN request at runtime.
Downloaded once with npm pack into an empty scratch directory on 2026-11-14; never load these packages from a CDN.

gsap 3.15.0 (npm: gsap@3.15.0, tarball gsap-3.15.0.tgz, sha256 d2e33ad202d4811e9084883f7ff9a27967ac4095caef51ca4c9d20697a253b1c)
  license: GreenSock standard no-charge license, https://gsap.com/standard-license (see gsap-3.15.0/LICENSE.txt)
  files: package/dist/{gsap,ScrollTrigger,SplitText,CustomEase}.min.js
lenis 1.3.27 (npm: lenis@1.3.27, tarball lenis-1.3.27.tgz, sha256 0a2437de050959246edd645a2ffa8b50a6ff6b80d98f6d960f1b4557a4c4209e)
  license: MIT (lenis-1.3.27/LICENSE); files: package/dist/lenis.min.js (UMD, sets globalThis.Lenis), package/dist/lenis.css

Only change to the copied files: the trailing //# sourceMappingURL comment line was removed from lenis.min.js
(the .map file is not shipped, so browsers would request a missing file). The GSAP .min.js files are byte-identical
to the tarball (they carry no sourceMappingURL comment).

SHA-256 of every shipped file:
  466e426a5c60c21c94b15a30a3dffacac9bb39ce8f4e07d071d7d4bb1be43390  gsap-3.15.0/CustomEase.min.js
  f54569cb3145d0143e618fd32e2ef04b5764bb471ad88fe208bf18b6687cabdb  gsap-3.15.0/LICENSE.txt
  b0b14d67b55b0c43c756ac0b106cfcb09d0879945f6ead64451065b0672916a2  gsap-3.15.0/ScrollTrigger.min.js
  419f7027a5f086a12cb7988736d8fdd3a6ed2200229661de25b6628ca7ced344  gsap-3.15.0/SplitText.min.js
  92bb9a96476f983d212a2bc4f54c889039c1696dd4461d40a736860938570fbb  gsap-3.15.0/gsap.min.js
  7d1896b31f2eed9f286b05faca067c4e35b2f109ae7c4ed5105220e2d2820228  lenis-1.3.27/LICENSE
  2f668ae84a668327f246faf8a770383a2bf69196d214290fbc4d5548910606c5  lenis-1.3.27/lenis.css
  07020831fc52c75dc556473f50ddbf993ca65f1b920394ebd04dfd8c1824d952  lenis-1.3.27/lenis.min.js

SHA-256 of the untouched upstream .min.js files (before removing the sourceMappingURL line):
  92bb9a96476f983d212a2bc4f54c889039c1696dd4461d40a736860938570fbb  gsap-3.15.0/gsap.min.js (upstream)
  b0b14d67b55b0c43c756ac0b106cfcb09d0879945f6ead64451065b0672916a2  gsap-3.15.0/ScrollTrigger.min.js (upstream)
  419f7027a5f086a12cb7988736d8fdd3a6ed2200229661de25b6628ca7ced344  gsap-3.15.0/SplitText.min.js (upstream)
  466e426a5c60c21c94b15a30a3dffacac9bb39ce8f4e07d071d7d4bb1be43390  gsap-3.15.0/CustomEase.min.js (upstream)
  80f53e77f1c13e379fc246d2b5e299188e20bcb2b2fe7ebb13e8e8c7563a6da7  lenis-1.3.27/lenis.min.js (upstream)

Fonts (../fonts/): TikTok Sans, SIL Open Font License 1.1 (fonts/OFL.txt), fetched once from the Google Fonts css2 API
(family=TikTok+Sans:opsz,wdth,wght@12..36,100..130,400..760), subsets vietnamese, latin-ext, latin:
  8284939960c03bb96240ac3ce6301b83c839d5bb5591c32252b45d1822dac14e  fonts/tiktok-sans-latin-ext.woff2 (75588 bytes)
  34dcf0f1e66316dc85f81a5b1837f44421b99106f8a49b8b8bfcdbac3ff8ab22  fonts/tiktok-sans-latin.woff2 (115116 bytes)
  fb17bff6a596341946c47bb44ab9c3683da8dcb1f9d227690dc0291428d33d72  fonts/tiktok-sans-vietnamese.woff2 (25652 bytes)
