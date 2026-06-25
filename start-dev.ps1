# $root = "C:\Users\NAJMUL\Desktop\HTML"

# wt `
#   new-tab --title "Laravel API" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan serve --host=127.0.0.1 --port=8000" `
#   `; new-tab --title "Queue Worker" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan queue:work --tries=3" `
#   `; new-tab --title "Scheduler" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan schedule:work" `
#   `; new-tab --title "Admin" --startingDirectory "$root\admin" powershell -NoExit -Command "npm run dev" `
#   `; new-tab --title "Frontend" --startingDirectory "$root\frontend" powershell -NoExit -Command "npm run dev"


$root = "C:\Users\NAJMUL\Desktop\HTML"

if (!(Test-Path "$root\backend")) {
  Write-Host "Backend folder not found: $root\backend" -ForegroundColor Red
  exit
}

if (!(Test-Path "$root\admin")) {
  Write-Host "Admin folder not found: $root\admin" -ForegroundColor Red
  exit
}

if (!(Test-Path "$root\frontend")) {
  Write-Host "Frontend folder not found: $root\frontend" -ForegroundColor Red
  exit
}

wt -w 0 `
  new-tab --title "Laravel API" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan serve --host=0.0.0.0 --port=8000" `
  `; new-tab --title "Queue Worker" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan queue:work --tries=3" `
  `; new-tab --title "Scheduler" --startingDirectory "$root\backend" powershell -NoExit -Command "php artisan schedule:work" `
  `; new-tab --title "Admin" --startingDirectory "$root\admin" powershell -NoExit -Command "npm run dev -- --host 0.0.0.0 --port 5174 --strictPort" `
  `; new-tab --title "Frontend" --startingDirectory "$root\frontend" powershell -NoExit -Command "npm run dev -- --host 0.0.0.0 --port 5173 --strictPort"