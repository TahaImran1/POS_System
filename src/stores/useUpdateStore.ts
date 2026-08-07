import { defineStore } from 'pinia'

export interface GitHubReleaseInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseTitle?: string
  releaseNotes?: string
  publishedAt?: string
  downloadUrl?: string
  htmlUrl?: string
  error?: string
}

export const useUpdateStore = defineStore('update', {
  state: () => ({
    isChecking: false,
    currentVersion: '1.0.1',
    updateInfo: null as GitHubReleaseInfo | null,
    lastChecked: null as Date | null
  }),
  actions: {
    async checkUpdate() {
      this.isChecking = true
      try {
        const electronAPI = (window as any).electronAPI
        if (electronAPI && electronAPI.checkGitHubReleaseUpdate) {
          const res = await electronAPI.checkGitHubReleaseUpdate()
          this.updateInfo = res
          if (res.currentVersion) this.currentVersion = res.currentVersion
        } else {
          // Web fallback
          this.updateInfo = {
            hasUpdate: false,
            currentVersion: this.currentVersion,
            error: 'Running in Web Preview mode. GitHub Release manual updater runs inside Electron Desktop App.'
          }
        }
        this.lastChecked = new Date()
      } catch (err: any) {
        this.updateInfo = {
          hasUpdate: false,
          currentVersion: this.currentVersion,
          error: err.message || 'Could not connect to GitHub Release API.'
        }
      } finally {
        this.isChecking = false
      }
    },

    async openDownloadPage() {
      const url = this.updateInfo?.downloadUrl || this.updateInfo?.htmlUrl || 'https://github.com/TahaImran1/POS_System/releases'
      const electronAPI = (window as any).electronAPI
      if (electronAPI && electronAPI.openExternalUrl) {
        await electronAPI.openExternalUrl(url)
      } else {
        window.open(url, '_blank')
      }
    }
  }
})
