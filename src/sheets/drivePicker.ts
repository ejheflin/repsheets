import { getStoredUser } from '../auth/googleAuth'
import { GOOGLE_API_KEY } from '../config'

export interface PickerFile {
  id: string
  name: string
  mimeType: string
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) { resolve(); return }
    const onGapiLoaded = () => {
      window.gapi.load('picker', { callback: resolve, onerror: reject })
    }
    if (window.gapi) { onGapiLoaded(); return }
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = onGapiLoaded
    script.onerror = () => reject(new Error('Failed to load Google API'))
    document.body.appendChild(script)
  })
}

export async function openRepSheetPicker(
  onPick: (file: PickerFile) => void,
  onCancel: () => void,
): Promise<void> {
  const accessToken = getStoredUser()?.accessToken
  if (!accessToken) { onCancel(); return }

  await loadPickerApi()

  new window.google.picker!.PickerBuilder()
    .addView(window.google.picker!.ViewId.SPREADSHEETS)
    .setOAuthToken(accessToken)
    .setDeveloperKey(GOOGLE_API_KEY)
    .setCallback((data) => {
      if (data.action === window.google.picker!.Action.PICKED && data.docs?.[0]) {
        onPick(data.docs[0])
      } else if (data.action === window.google.picker!.Action.CANCEL) {
        onCancel()
      }
    })
    .build()
    .setVisible(true)
}
