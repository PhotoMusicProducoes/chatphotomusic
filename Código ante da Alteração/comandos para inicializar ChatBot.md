cd "E:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\"
git status
git add .
git add package.json package-lock.json
git commit -m "Atualização do sistema"
git push
flyctl deploy --app chatphotomusic
flyctl logs -a chatphotomusic

se aparecer 
Error: unauthorized

flyctl auth login
para fazer o login que expirou

caso não inicie o sistema usar
flyctl deploy --app chatphotomusic --depot=false

cd "E:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\"
git status
git add .
git add package.json package-lock.json
git commit -m "Atualização do sistema"
git push
flyctl deploy --app chatphotomusic --local-only

