$root = "C:\Users\NAJMUL\Desktop\HTML"

wt `
  new-tab --title "Laravel API" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan serve --host=127.0.0.1 --port=8000" `
  `; new-tab --title "Queue Worker" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan queue:work --tries=3" `
  `; new-tab --title "Scheduler" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan schedule:work" `
  `; new-tab --title "Admin" --startingDirectory "$root\admin" powershell -NoExit -Command "npm run dev" `
  `; new-tab --title "Frontend" --startingDirectory "$root\frontend" powershell -NoExit -Command "npm run dev"