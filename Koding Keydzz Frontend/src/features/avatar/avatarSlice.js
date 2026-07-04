import { createSlice } from '@reduxjs/toolkit'

// The equipped avatar map is owned by the backend (GET /avatar/me). This slice
// is only a local cache that mirrors the server's equipped state and supports
// optimistic updates while a PUT /avatar/me is in flight.
const initialState = { equipped: {} }

const avatarSlice = createSlice({
  name: 'avatar',
  initialState,
  reducers: {
    setEquipped: (state, action) => {
      state.equipped = action.payload || {}
    },
    equipItem: (state, action) => {
      const { slot, id } = action.payload
      state.equipped[slot] = id
    },
  },
})

export const { setEquipped, equipItem } = avatarSlice.actions
export default avatarSlice.reducer

export const selectEquipped = (state) => state.avatar.equipped
