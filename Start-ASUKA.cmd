@echo off
setlocal
set "ASUKA_DATA_DIR=E:\ASUKA\data\user-data"
set "ASUKA_USER_DATA_DIR=E:\ASUKA\data\user-data"
set "TEMP=E:\ASUKA\.runtime-temp"
set "TMP=E:\ASUKA\.runtime-temp"
if not exist "E:\ASUKA\.runtime-temp" mkdir "E:\ASUKA\.runtime-temp"
start "" "E:\ASUKA\release\ASUKA-0.8.39-portable.exe" --user-data-dir="E:\ASUKA\data\user-data"
