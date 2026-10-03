import subprocess
import os
import sys
import shutil
import datetime
import hashlib

os.makedirs("artifacts/logs", exist_ok=True)
os.makedirs("public/artifacts/logs", exist_ok=True)

def get_tool_versions():
    versions = {}
    tools = [
        ("Node.js", "node -v"),
        ("NPM", "npm -v"),
        ("TypeScript", "npx tsc -v"),
        ("Vite", "npx vite -v"),
        ("Firebase CLI", "firebase --version"),
        ("Java Runtime", "java -version 2>&1 | head -n 1"),
    ]
    for tool, cmd in tools:
        try:
            res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            out = res.stdout.strip() or res.stderr.strip()
            if not out or "not found" in out:
                versions[tool] = "NOT_INSTALLED (Missing on system PATH)"
            else:
                versions[tool] = out
        except:
            versions[tool] = "NOT_INSTALLED"
    return versions

def get_source_fingerprint():
    # Strict validation of required configuration files and source directories
    mandatory_root_configs = [
        "firestore.rules",
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "server.ts",
        "index.html",
        "firebase.json",
        ".env.example"
    ]
    for mrc in mandatory_root_configs:
        if not os.path.exists(mrc):
            raise FileNotFoundError(f"Mandatory configuration file missing for fingerprinting: {mrc}")

    if not os.path.isdir("src") or not os.path.isdir("scripts"):
        raise FileNotFoundError("Mandatory source directories 'src' and 'scripts' must exist.")

    optional_root_configs = [
        "firebase-blueprint.json",
        "firebase-applet-config.json",
        "firestore.indexes.json",
        "metadata.json",
        "CHANGELOG.md"
    ]

    all_source_files = list(mandatory_root_configs)
    for rc in optional_root_configs:
        if os.path.exists(rc):
            all_source_files.append(rc)
            
    for root, _, files in os.walk("src"):
        for f in files:
            all_source_files.append(os.path.join(root, f))
            
    for root, _, files in os.walk("scripts"):
        for f in files:
            if not f.endswith(".log"):
                all_source_files.append(os.path.join(root, f))
                
    all_source_files = sorted(list(set(all_source_files)))
    
    if len(all_source_files) < 10:
        raise ValueError(f"Abnormally low source file count ({len(all_source_files)}). Refusing to generate log with invalid scope.")
        
    h = hashlib.sha256()
    for sf in all_source_files:
        with open(sf, "rb") as f:
            h.update(f"{sf}:".encode("utf-8"))
            h.update(f.read())
            
    return h.hexdigest(), len(all_source_files)

versions = get_tool_versions()
fingerprint, total_source_files = get_source_fingerprint()
working_dir = os.getcwd()
run_id = f"RUN-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')}"

def run_and_log(cmd: str, log_filename: str, log_title: str):
    start_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
    print(f"Executing: {cmd} -> {log_filename}")
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    exit_code = proc.returncode
    stdout = proc.stdout
    stderr = proc.stderr

    log_path = os.path.join("artifacts/logs", log_filename)
    public_log_path = os.path.join("public/artifacts/logs", log_filename)

    with open(log_path, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write(f"CR-AUTH-BACKUP-001: {log_title.upper()} LOG\n")
        f.write("=" * 80 + "\n")
        f.write(f"Run ID      : {run_id}\n")
        f.write(f"Timestamp   : {start_time}\n")
        f.write(f"Command     : {cmd}\n")
        f.write(f"Working Dir : {working_dir}\n")
        f.write(f"Tools       : Node {versions.get('Node.js')} | NPM {versions.get('NPM')} | TS {versions.get('TypeScript')} | Vite {versions.get('Vite')}\n")
        f.write(f"CLI / Java  : Firebase CLI {versions.get('Firebase CLI')} | Java {versions.get('Java Runtime')}\n")
        f.write(f"Target Env  : Project: demo-piket-guru | Host: 127.0.0.1:8080 (Loopback Firestore Emulator)\n")
        f.write(f"Fingerprint : {fingerprint} (scope: {total_source_files} files)\n")
        f.write(f"Exit Code   : {exit_code}\n")
        f.write("-" * 80 + "\n")
        f.write("STDOUT:\n")
        f.write("-" * 80 + "\n")
        f.write(stdout if stdout else "(empty stdout)\n")
        if stderr:
            f.write("-" * 80 + "\n")
            f.write("STDERR:\n")
            f.write("-" * 80 + "\n")
            f.write(stderr + "\n")
        f.write("=" * 80 + "\n")
        f.write(f"END OF LOG: {log_filename}\n")
        f.write("=" * 80 + "\n")

    shutil.copyfile(log_path, public_log_path)
    size = os.path.getsize(log_path)
    with open(log_path, "rb") as lf:
        sha = hashlib.sha256(lf.read()).hexdigest()
    print(f"Finished {log_filename} (Exit: {exit_code}, Size: {size} bytes, SHA-256: {sha})")
    return exit_code

# 1. Typecheck
e1 = run_and_log("npx tsc --noEmit", "01_tsc_typecheck.log", "TypeScript Typecheck")

# 2. Vite Build
e2 = run_and_log("npm run build", "02_vite_build.log", "Application Production Build")

# 3. Isolated Acceptance Test
e3 = run_and_log("npx tsx scripts/isolated_acceptance_test.ts", "03_isolated_acceptance.log", "Isolated Acceptance Test Suite")

# 4. Rules Emulator Test (attempting execution via Firebase CLI emulators:exec)
e4 = run_and_log('firebase emulators:exec --only firestore --project demo-piket-guru "npx tsx scripts/test_rules_emulator.ts"', "04_rules_emulator.log", "Firestore Security Rules Emulator Test Suite")

overall_exit = 0 if (e1 == 0 and e2 == 0 and e3 == 0 and e4 == 0) else 1
print(f"All logs generated. Aggregated exit code: {overall_exit} (e1={e1}, e2={e2}, e3={e3}, e4={e4})")
sys.exit(overall_exit)
