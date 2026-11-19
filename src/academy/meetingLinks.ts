export type MeetingProvider = 'Teams' | 'Zoom'

export function meetingProvider(value: string): MeetingProvider | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'].includes(url.hostname) && url.pathname.length > 1) return 'Teams'
    if ((url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us')) && /^\/(j|my)\/.+/.test(url.pathname)) return 'Zoom'
  } catch {
    return null
  }
  return null
}

export function meetingLinkPair(teams: string, zoom: string, primary: MeetingProvider) {
  const teamsUrl = teams.trim()
  const zoomUrl = zoom.trim()
  if (teamsUrl && meetingProvider(teamsUrl) !== 'Teams') throw new Error('Enter a valid Teams meeting link.')
  if (zoomUrl && meetingProvider(zoomUrl) !== 'Zoom') throw new Error('Enter a Zoom participant link (/j/ or /my/).')
  const order = primary === 'Teams' ? [teamsUrl, zoomUrl] : [zoomUrl, teamsUrl]
  const [first, second] = order.filter(Boolean)
  return {meeting_url: first || null, meeting_backup_url: second || null}
}
