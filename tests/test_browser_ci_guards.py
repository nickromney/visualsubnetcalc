from pathlib import Path
import tempfile,subprocess,os,socket,json,datetime,hashlib
root=Path(__file__).resolve().parents[1];env={**os.environ,'CI':'true'};env.pop('NO_SERVER',None)
with tempfile.TemporaryDirectory(prefix='visual-ci-guard-') as directory:
 fixture=Path(directory);(fixture/'src/tests').mkdir(parents=True);(fixture/'node_modules').symlink_to(root/'node_modules',target_is_directory=True);config=fixture/'playwright.config.ts';config.write_bytes((root/'playwright.config.ts').read_bytes());test=fixture/'src/tests/guard.spec.ts';cli=root/'node_modules/@playwright/test/cli.js'
 test.write_text("import { test } from '@playwright/test'; test.only('focused fixture', async () => {});\n")
 focused=subprocess.run(['node',str(cli),'test','--config',str(config),'--list'],cwd=fixture,env=env,capture_output=True,text=True,timeout=30)
 assert focused.returncode!=0 and 'test.only' in focused.stdout+focused.stderr,(focused.returncode,focused.stdout,focused.stderr)
 test.write_text("import { test } from '@playwright/test'; test('whole fixture', async () => {});\n")
 # Owned ephemeral test port avoids touching the real developer port8443.
 blocker=socket.socket();blocker.bind(('127.0.0.1',0));port=blocker.getsockname()[1];blocker.listen(1)
 config.write_text(config.read_text().replace('port: 8443,',f'port: {port},'))
 occupied=subprocess.run(['node',str(cli),'test','--config',str(config),'--project=chromium','--reporter=line'],cwd=fixture,env=env,capture_output=True,text=True,timeout=30)
 blocker.close();assert occupied.returncode!=0 and 'already used' in occupied.stdout+occupied.stderr,(occupied.returncode,occupied.stdout,occupied.stderr)
 out={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'real installed Playwright consumer in disposable fixture; no user server termination/network','config_source_sha256':hashlib.sha256((root/'playwright.config.ts').read_bytes()).hexdigest(),'focused_test':{'exit_code':focused.returncode,'output':focused.stdout+focused.stderr},'occupied_server':{'exit_code':occupied.returncode,'port':'ephemeral owned fixture port','output':occupied.stdout+occupied.stderr}}
 print(json.dumps(out,sort_keys=True))
 print('Actual focused-test and occupied-server refusals passed.')
