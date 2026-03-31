git status
git add .
git add package.json package-lock.json
git commit -m "Atualização do sistema"
git push
flyctl deploy --app chatphotomusic
flyctl logs -a chatphotomusic
