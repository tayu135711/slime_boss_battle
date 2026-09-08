#!/bin/bash
# slime_boss_battle のコミット著者メール不一致を直すスクリプト
# 使い方: リポジトリのルートで実行してください
#   bash fix_git_email.sh
set -e

echo "1) このリポジトリのメールアドレスを正しいものに設定します"
git config user.email "sakeikura1642@gmail.com"
git config user.name "tayu135711"

echo "2) 直近2コミットの著者情報を書き換えます（エディタが開いたらそのまま保存して閉じてください）"
git rebase -i HEAD~2 --exec "git commit --amend --reset-author --no-edit"

echo "3) 修正が終わったら、以下を実行してGitHubに反映してください:"
echo "   git push --force-with-lease"
echo ""
echo "完了後、git log -3 --pretty=fuller で Author/Commit のメールが"
echo "sakeikura1642@gmail.com になっているか確認してください。"
