'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAllRankingChanges } from '@/lib/utils/ladder'

interface TransactionLogEntry {
  id: string
  change_type: 'rank_adjustment' | 'match'
  timestamp: string
  player_id?: string
  old_rank?: number
  new_rank?: number
  player1_id?: string
  player2_id?: string
  match_winner?: number
  reason?: string
  adjusted_by?: string
  players?: {
    name: string
  }
  player1?: {
    name: string
  }
  player2?: {
    name: string
  }
  rank_changes?: Array<{
    player_id: string
    player_name: string
    old_rank: string | number
    new_rank: string | number
    change_type: string
  }>
}

export default function TransactionLogView() {
  const [transactions, setTransactions] = useState<TransactionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'rank_adjustment' | 'match'>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchTransactionLog()
  }, [])

  const fetchTransactionLog = async () => {
    setLoading(true)
    try {
      const data = await getAllRankingChanges(supabase)
      setTransactions(data)
    } catch (error) {
      setMessage(`Error fetching transaction log: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }



  const handleDeleteRankAdjustment = async (adjustmentId: string) => {
    if (!confirm('Are you sure you want to delete this rank adjustment? This will trigger a rebuild of all rankings from the timeline.')) {
      return
    }

    setLoading(true)
    try {
      // Delete the rank adjustment
      const { error } = await supabase
        .from('rank_adjustments')
        .delete()
        .eq('id', adjustmentId)

      if (error) {
        throw error
      }

      setMessage('Rank adjustment deleted successfully! Rebuilding rankings...')
      
      // Rebuild rankings from timeline
      const { rebuildRankingsFromTimeline } = await import('@/lib/utils/ladder')
      await rebuildRankingsFromTimeline(supabase)
      
      setMessage('Rank adjustment deleted and rankings rebuilt successfully!')
      
      // Refresh the transaction log
      await fetchTransactionLog()
      
    } catch (error) {
      setMessage(`Error deleting rank adjustment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getFilteredTransactions = () => {
    if (filterType === 'all') return transactions
    return transactions.filter(t => t.change_type === filterType)
  }

  const getTransactionDescription = (transaction: TransactionLogEntry) => {
    if (transaction.change_type === 'rank_adjustment') {
      const playerName = transaction.players?.name || 'Unknown Player'
      const change = transaction.new_rank! - transaction.old_rank!
      const changeText = change > 0 ? `+${change}` : change.toString()
      const changeColor = change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
      
      return (
        <div>
          <span className="font-medium">{playerName}</span>
          <span className="mx-2">moved from</span>
          <span className="font-medium">#{transaction.old_rank}</span>
          <span className="mx-2">to</span>
          <span className="font-medium">#{transaction.new_rank}</span>
          <span className={`ml-2 font-medium ${changeColor}`}>({changeText})</span>
        </div>
      )
    } else {
      const player1Name = transaction.player1?.name || 'Unknown Player 1'
      const player2Name = transaction.player2?.name || 'Unknown Player 2'
      const winnerName = transaction.match_winner === 1 ? player1Name : player2Name
      
      return (
        <div>
          <span className="font-medium">{player1Name}</span>
          <span className="mx-2">vs</span>
          <span className="font-medium">{player2Name}</span>
          <span className="mx-2">→</span>
          <span className="font-medium text-green-600">{winnerName} won</span>
        </div>
      )
    }
  }

  const getTransactionIcon = (transaction: TransactionLogEntry) => {
    if (transaction.change_type === 'rank_adjustment') {
      return (
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
      )
    } else {
      return (
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading transaction log...</p>
      </div>
    )
  }

  const filteredTransactions = getFilteredTransactions()

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-md ${
          message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Transaction Log</h2>
            <p className="text-sm text-gray-600 mt-1">
              Complete timeline of all ranking changes and match results
            </p>
          </div>
                       <div className="flex items-center space-x-4">
               <div className="flex items-center space-x-2">
                 <span className="text-sm text-gray-600">Filter:</span>
                 <select
                   value={filterType}
                   onChange={(e) => setFilterType(e.target.value as 'all' | 'rank_adjustment' | 'match')}
                   className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 >
                   <option value="all">All Changes</option>
                   <option value="rank_adjustment">Rank Adjustments</option>
                   <option value="match">Matches</option>
                 </select>
               </div>
               <button
                 onClick={fetchTransactionLog}
                 className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                 disabled={loading}
               >
                 Refresh
               </button>
               
             </div>
        </div>
        
        <div className="overflow-x-auto">
          {filteredTransactions.length > 0 ? (
            <div className="p-6">
              <div className="space-y-4">
                {filteredTransactions.map((transaction, index) => (
                  <div key={transaction.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {getTransactionIcon(transaction)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-900">
                          {getTransactionDescription(transaction)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(transaction.timestamp)}
                        </div>
                      </div>
                      
                       {transaction.change_type === 'rank_adjustment' && transaction.reason && (
                         <div className="mt-2 text-sm text-gray-600">
                           <span className="font-medium">Reason:</span> {transaction.reason}
                         </div>
                       )}
                       
                       {transaction.change_type === 'rank_adjustment' && transaction.adjusted_by && (
                         <div className="mt-1 text-xs text-gray-500">
                           Adjusted by: {transaction.adjusted_by}
                         </div>
                       )}

                       {transaction.change_type === 'rank_adjustment' && (
                         <div className="mt-3 flex justify-end">
                           <button
                             onClick={() => handleDeleteRankAdjustment(transaction.id)}
                             className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                             disabled={loading}
                           >
                             Delete Adjustment
                           </button>
                         </div>
                       )}

                       {transaction.change_type === 'match' && transaction.rank_changes && transaction.rank_changes.length > 0 && (
                         <div className="mt-2 text-sm text-gray-600">
                           <span className="font-medium">Rank Changes:</span>
                           <div className="mt-1 space-y-1">
                             {transaction.rank_changes.map((rankChange, index) => (
                               <div key={index} className="flex items-center space-x-2">
                                 <span className="text-xs text-gray-500">•</span>
                                 <span className="font-medium">{rankChange.player_name}</span>
                                 <span className="text-gray-500">
                                   {rankChange.old_rank === '?' ? 
                                     (rankChange.change_type === 'winner_moved_up' ? 'moved up' : 'moved down') : 
                                     `${rankChange.old_rank} → ${rankChange.new_rank}`}
                                 </span>
                                 <span className={`text-xs px-2 py-1 rounded ${
                                   rankChange.change_type === 'winner_moved_up' 
                                     ? 'bg-green-100 text-green-700' 
                                     : 'bg-red-100 text-red-700'
                                 }`}>
                                   {rankChange.change_type === 'winner_moved_up' ? 'Winner' : 'Loser'}
                                 </span>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              {filterType === 'all' 
                ? 'No transactions found. Start making changes to see them here.'
                : `No ${filterType === 'rank_adjustment' ? 'rank adjustments' : 'matches'} found.`
              }
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-800 mb-3">Transaction Log Overview</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            This log shows all ranking changes in chronological order. <span className="font-medium">Rank Adjustments</span> are manual changes by administrators, 
            while <span className="font-medium">Matches</span> show game results that affected rankings. The system starts with natural order (by creation date) 
            and applies each transaction sequentially to create deterministic rankings.
          </p>
          <p>
            Players are deactivated (not deleted) to preserve all historical data. Delete rank adjustments directly from this log when needed.
          </p>
        </div>
      </div>
    </div>
  )
} 