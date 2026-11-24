#!/usr/bin/env python3
# Đẩy 1 commit local lên nhánh remote bằng GitHub Git Data API
# (git push không xác thực được trong VM này).
# Dùng: python3 push-via-api.py <repo> <branch> <local-commit-sha>
# Tạo commit mới trên remote với cùng cây + cùng thông điệp, cha là
# đầu nhánh remote hiện tại. In SHA commit mới + SHA cây để đối chiếu.
import base64
import json
import subprocess
import sys

GH = ['python3', '/home/hatch/workspace/custom-connectors/custom.github-pat/bin/gh_pat.py']
REPO, BRANCH, LOCAL_SHA = sys.argv[1], sys.argv[2], sys.argv[3]


def call(method, path, body=None):
    cmd = GH + ['call', method, path]
    if body is not None:
        with open('/tmp/gh-push-body.json', 'w', encoding='utf-8') as f:
            json.dump(body, f)
        cmd += ['--body-file', '/tmp/gh-push-body.json']
    out = subprocess.run(cmd, capture_output=True, text=True, check=True)
    res = json.loads(out.stdout)
    if res['status'] >= 300:
        raise RuntimeError(f'{method} {path} -> {res["status"]}: {out.stdout[:500]}')
    return res['body']


def git(*args):
    return subprocess.run(['git'] + list(args), capture_output=True, text=True,
                          cwd='/home/hatch/workspace/xxmm-tagcolors', check=True).stdout.strip()


# 1. Đầu nhánh remote hiện tại + cây của nó.
ref = call('GET', f'/repos/{REPO}/git/ref/heads/{BRANCH}')
head_sha = ref['object']['sha']
head_commit = call('GET', f'/repos/{REPO}/git/commits/{head_sha}')
base_tree = head_commit['tree']['sha']
print('remote head:', head_sha, 'tree:', base_tree)

# 2. File đổi trong commit local (so với cha của nó).
changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', LOCAL_SHA).split('\n')
changed = [p for p in changed if p]
print('changed files:', changed)
tree_items = []
for path in changed:
    # File bị xóa trong commit local: không có blob -> xóa khỏi cây bằng
    # sha=null (API Git Data). Kiểm tra bằng cat-file thay vì rev-parse
    # để khỏi văng lỗi.
    exists = subprocess.run(['git', 'cat-file', '-e', f'{LOCAL_SHA}:{path}'],
                            cwd='/home/hatch/workspace/xxmm-tagcolors').returncode == 0
    if not exists:
        print(f'deleted {path}: removing from tree')
        tree_items.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': None})
        continue
    blob_sha = git('rev-parse', f'{LOCAL_SHA}:{path}')
    # Blob đã có sẵn ở local nhưng remote chưa chắc có -> tạo mới qua API.
    content = subprocess.run(['git', 'show', f'{LOCAL_SHA}:{path}'],
                             capture_output=True, cwd='/home/hatch/workspace/xxmm-tagcolors',
                             check=True).stdout
    blob = call('POST', f'/repos/{REPO}/git/blobs',
                {'content': base64.b64encode(content).decode(), 'encoding': 'base64'})
    print(f'blob {path}: local {blob_sha} remote {blob["sha"]} match={blob_sha == blob["sha"]}')
    tree_items.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})

# 3. Cây mới + commit mới (cùng thông điệp với commit local).
tree = call('POST', f'/repos/{REPO}/git/trees', {'base_tree': base_tree, 'tree': tree_items})
print('new tree:', tree['sha'])
local_tree = git('rev-parse', f'{LOCAL_SHA}^{{tree}}')
print('local tree:', local_tree, 'match=', tree['sha'] == local_tree)
message = git('show', '-s', '--format=%B', LOCAL_SHA)
commit = call('POST', f'/repos/{REPO}/git/commits',
              {'message': message, 'tree': tree['sha'], 'parents': [head_sha]})
print('new commit:', commit['sha'])

# 4. Đưa nhánh remote tới commit mới.
call('PATCH', f'/repos/{REPO}/git/refs/heads/{BRANCH}', {'sha': commit['sha'], 'force': False})
print('ref updated:', BRANCH, '->', commit['sha'])
