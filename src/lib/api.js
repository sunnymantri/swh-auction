// =====================================================================
//  Data layer: every DB read/write the UI needs, in one place.
//  Mutations that change auction state go through the SECURITY DEFINER
//  RPCs (place_bid, mark_sold, ...) so the budget/squad rules are
//  enforced server-side and are race-safe.
// =====================================================================
import { supabase } from './supabase'
export { exportPlayersCsv, parsePlayersCsv, parsePlayersCsvDetailed, playersCsvTemplate,
         exportSquadsCsv, exportAuctionStatusCsv } from './csv'

// ---- Auction ----
export async function getAuctionById(auctionId) {
  const { data, error } = await supabase
    .from('auctions')
    .select('*')
    .eq('id', auctionId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listAuctions() {
  const { data, error } = await supabase
    .from('auctions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createAuction(payload) {
  const { data, error } = await supabase
    .from('auctions')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setAuctionStatus(auctionId, status) {
  const { error } = await supabase
    .from('auctions').update({ status }).eq('id', auctionId)
  if (error) throw error
}

export async function updateAuction(auctionId, payload) {
  const { data, error } = await supabase
    .from('auctions')
    .update(payload)
    .eq('id', auctionId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- Teams ----
export async function listTeamSummaries(auctionId) {
  const { data, error } = await supabase
    .from('team_summary').select('*')
    .eq('auction_id', auctionId).order('name')
  if (error) throw error
  return data
}

export async function listTeams(auctionId) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('auction_id', auctionId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createTeam(payload) {
  const { data, error } = await supabase
    .from('teams')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTeam(teamId, payload) {
  const { data, error } = await supabase
    .from('teams')
    .update(payload)
    .eq('id', teamId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTeam(teamId) {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) throw error
}

// ---- Players / queue ----
export async function getCurrentQueueItem(auctionId) {
  const { data, error } = await supabase
    .from('auction_queue')
    .select('*, players(*)')
    .eq('auction_id', auctionId).eq('status', 'current')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getQueue(auctionId) {
  const { data, error } = await supabase
    .from('auction_queue')
    .select('*, players(name, role, category, base_price, photo_url, status)')
    .eq('auction_id', auctionId).order('queue_order')
  if (error) throw error
  return data
}

export async function listPlayers(auctionId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createPlayer(payload) {
  const { data, error } = await supabase
    .from('players')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlayer(playerId, payload) {
  const { data, error } = await supabase
    .from('players')
    .update(payload)
    .eq('id', playerId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePlayer(playerId) {
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}

export async function getUnsoldOrReauction(auctionId) {
  const { data, error } = await supabase
    .from('players').select('*')
    .eq('auction_id', auctionId).in('status', ['unsold', 'reauction'])
    .order('name')
  if (error) throw error
  return data
}

// Next player to call: lowest queue_order still awaiting auction.
export async function getNextPending(auctionId) {
  const { data, error } = await supabase
    .from('auction_queue')
    .select('*, players!inner(*)')
    .eq('auction_id', auctionId)
    .in('status', ['pending', 'reauction'])
    .in('players.status', ['ready_for_auction', 'reauction'])
    .order('queue_order').limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function moveQueueItem(queueId, queueOrder) {
  const { data, error } = await supabase
    .from('auction_queue')
    .update({ queue_order: queueOrder })
    .eq('id', queueId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listSoldPlayers(auctionId) {
  const { data, error } = await supabase
    .from('sold_players')
    .select('*, players(*), teams(id, auction_id, name, short_name, logo_url, owner_user_id)')
    .eq('auction_id', auctionId)
    .order('sold_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listNonRegularBowlers(auctionId) {
  const { data, error } = await supabase
    .from('team_non_regular_bowlers')
    .select('*')
    .eq('auction_id', auctionId)
  if (error) throw error
  return data ?? []
}

// Active (un-reversed) sale for a player, for the Re-auction action.
export async function getActiveSale(playerId) {
  const { data, error } = await supabase
    .from('sold_players').select('*')
    .eq('player_id', playerId).eq('reauctioned', false)
    .maybeSingle()
  if (error) throw error
  return data
}

// ---- Bids / events ----
export async function getBidsForPlayer(playerId) {
  const { data, error } = await supabase
    .from('bids').select('*, teams(name, short_name)')
    .eq('player_id', playerId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getRecentEvents(auctionId, limit = 25) {
  const { data, error } = await supabase
    .from('auction_events')
    .select('*, players(name, photo_url), teams(name, short_name, logo_url)')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function listCategories(auctionId) {
  const { data, error } = await supabase
    .from('player_categories')
    .select('*')
    .eq('auction_id', auctionId)
    .order('sequence_order')
  if (error) throw error
  return data ?? []
}

export async function createCategory(payload) {
  const { data, error } = await supabase
    .from('player_categories')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(categoryId, payload) {
  const { data, error } = await supabase
    .from('player_categories')
    .update(payload)
    .eq('id', categoryId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(categoryId) {
  const { error } = await supabase.from('player_categories').delete().eq('id', categoryId)
  if (error) throw error
}

// ---- RPCs (the only sanctioned state mutations) ----
export const startPlayer = (playerId) =>
  rpc('start_player', { p_player_id: playerId })

export const placeBid = (playerId, teamId, amount, type = 'team_bid', override = false) =>
  rpc('place_bid', {
    p_player_id: playerId, p_team_id: teamId,
    p_bid_amount: amount, p_bid_type: type, p_override: override
  })

export const markSold = (playerId, teamId, soldPrice) =>
  rpc('mark_sold', { p_player_id: playerId, p_team_id: teamId, p_sold_price: soldPrice })

export const markUnsold = (playerId) =>
  rpc('mark_unsold', { p_player_id: playerId })

export const reauctionPlayer = (saleId) =>
  rpc('reauction_player', { p_sale_id: saleId })

export const generateQueue = (auctionId) =>
  rpc('generate_queue', { p_auction_id: auctionId })

export const resetAuction = (auctionId) =>
  rpc('reset_auction', { p_auction_id: auctionId })

export const recalculateTeamBudgets = (auctionId) =>
  rpc('recalculate_team_budgets', { p_auction_id: auctionId })

export const pauseCurrentClock = (auctionId) =>
  rpc('pause_current_clock', { p_auction_id: auctionId })

export const resumeCurrentClock = (auctionId) =>
  rpc('resume_current_clock', { p_auction_id: auctionId })

export const finalizeCurrentIfExpired = (auctionId) =>
  rpc('finalize_current_if_expired', { p_auction_id: auctionId })

export const setNonRegularBowlers = (teamId, playerIds) =>
  rpc('set_non_regular_bowlers', { p_team_id: teamId, p_player_ids: playerIds })

function safeStorageName(name = 'file') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
}

export async function uploadTeamLogo(file) {
  const path = `team-${Date.now()}-${safeStorageName(file.name)}`
  const { error } = await supabase.storage.from('team-logos').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadPlayerPhoto(file) {
  const path = `player-${Date.now()}-${safeStorageName(file.name)}`
  const { error } = await supabase.storage.from('player-photos').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('player-photos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadBranding(file) {
  const path = `brand-${Date.now()}-${safeStorageName(file.name)}`
  const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return data.publicUrl
}


async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const msg = (error.message || '')
      .replace(/^.*(?:BID_REJECTED|STATE_REJECTED|AUTH_REQUIRED):\s*/, '')
    throw new Error(msg || error.message)
  }
  return data
}


// ---- Vacation ----
export async function searchPlayersByName(auctionId, name) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, role, category, photo_url, weeks_away, vacation_dates')
    .eq('auction_id', auctionId)
    .ilike('name', `%${name}%`)
    .order('name')
    .limit(10)
  if (error) throw error
  return data ?? []
}

export async function updatePlayerVacation(playerId, vacationDates) {
  const { data, error } = await supabase.rpc('submit_player_vacation', {
    p_player_id: playerId,
    p_vacation_dates: vacationDates
  })
  if (error) throw error
  return data
}

// ---- Realtime ----
// Subscribe to all auction-relevant changes; cb() is debounced by caller.
export function subscribeToAuction(auctionId, cb) {
  const ch = supabase.channel(`auction:${auctionId}`)
  for (const table of ['bids', 'players', 'teams', 'sold_players',
                        'auction_queue', 'auction_events']) {
    ch.on('postgres_changes',
      { event: '*', schema: 'public', table, filter: `auction_id=eq.${auctionId}` },
      cb
    )
  }
  ch.subscribe()
  return () => supabase.removeChannel(ch)
}

// ---- CricHeroes stats fetch ----
export async function verifyPublicCode(code) {
  const { data, error } = await supabase.rpc('verify_public_code', { p_code: code ?? '' })
  if (error) throw new Error(error.message)
  return data === true
}

export async function fetchCricHeroesStats(profileUrl) {
  const { data, error } = await supabase.functions.invoke('fetch-cricheroes', {
    body: { profile_url: profileUrl }
  })
  if (error) {
    let detail = error.message
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) detail = ctx.error
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function fetchPlayHQStats(profileUrl) {
  const { data, error } = await supabase.functions.invoke('fetch-playhq', {
    body: { profile_url: profileUrl }
  })
  if (error) {
    let detail = error.message
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) detail = ctx.error
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
