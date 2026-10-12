; Installer and uninstaller additions for Clack Arena (included by electron-builder's NSIS script).

; "Is the game open?" Looks for its window instead of asking PowerShell (the stock check), which is quicker, works
; on every Windows version, and lets the installer be tested under Wine.
!macro customCheckAppRunning
  checkRunning:
  FindWindow $0 "Chrome_WidgetWin_1" "Clack Arena"
  ${if} $0 != 0
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Clack Arena is still open.$\r$\n$\r$\nClose it, then press Retry." /SD IDCANCEL IDRETRY checkRunning
    Quit
  ${endIf}
!macroend

; Uninstalling asks whether to delete your settings and tips too. No is the default, and updates never ask.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also delete your Clack Arena settings and saved tips?$\r$\n$\r$\nChoose No to keep them for next time." /SD IDNO IDNO keepData
      RMDir /r "$APPDATA\Clack Arena"
    keepData:
  ${endIf}
!macroend

; Always installs for just you: no admin password and no "who is this for" page.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
