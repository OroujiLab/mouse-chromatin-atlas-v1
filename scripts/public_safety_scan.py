#!/usr/bin/env python3
"""Conservative publication-safety scan of all tracked release files."""
import pathlib,re,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
paths=subprocess.check_output(["git","ls-files","-z"],cwd=root).decode().split("\0")
patterns={
    "private key":r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----",
    "GitHub token":r"\b(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{15,}",
    "AWS access key":r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "Google API key":r"\bAIza[0-9A-Za-z_-]{35}\b",
    "Bearer authorization":r"(?i)Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/-]{16,}",
    "credential assignment":r"(?im)^\s*(?:export\s+)?(?:ADMIN_PASSWORD|API_SECRET|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN|DATABASE_URL|PRIVATE_KEY)\s*[=:]\s*[^\s#]+",
    "internal Unix home path":r"(?:/Users/|/home/(?!runner/|oai/))[A-Za-z0-9._-]+/(?:Desktop|Documents|Downloads|projects|private)/",
    "private research links":r"(?i)(?:drive\.google\.com/drive/folders/1OuT12|drive\.google\.com/drive/folders/1zWg6|PRIVATE_RESEARCH_PREVIEW|PRIVATE_VALIDATED_SOURCE)",
}
issues=[]
for relative in paths:
    if not relative:continue
    path=root/relative
    if not path.is_file():continue
    raw=path.read_bytes()
    if b"\0" in raw:continue
    text=raw.decode("utf-8",errors="replace")
    for name,pattern in patterns.items():
        if name == "private research links" and relative in {"scripts/public_safety_scan.py", "tests/test_public_release_audit.py"}:\n            continue\n        if re.search(pattern,text):issues.append((relative,name))
if issues:
    for relative,name in issues:print("BLOCK:",relative,name)
    sys.exit(1)
print("Publication safety scan passed for",len([p for p in paths if p]),"tracked files")
