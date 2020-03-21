# vuex-electron-persisted-state

Vuex plugin for electron that persisting part or all state to a local file.

## Usage

Use as a plugin
```javascript
// src/store/index.js
import Vuex from 'vuex'
import { plugin as createPersistedState } from 'vuex-electron-sync-state'

const store = Vuex.Store({})

export default new Vuex.Store({
  modules: {
    user: {
      state: {
        userInfo: null,
        ...
      },
      mutations: {
        UPDATE_USER_INFO: (state, payload) => { state.userInfo = payload },
        CLEAR_USER_INFO: (state, payload) => { state.userInfo = null },
        ...
      },
      actions: {...}
    },
    friend: {
      state: {
        friendList: [],
        ...
      },
      mutations: {
        ADD_FRIEND: (state, payload) => { state.friendList.push(payload) },
        REMOVE_FRIEND: (state, payload) => {
          const findex = state.friendList.findIndex(it => it.uid === payload.uid)
          findex !== -1 && state.friendList.splice(findex, 1)
        },
        ...
      },
      actions: {...}
    },
    otherModule: {...}
  },
  plugins: [
    createPersistedState({
      name: 'myinfo', // filename(without extname), default: 'config'
      fileExtension: 'dat', // extname, default: 'json'
      cwd: 'path/to/save/dir/', // dirname, default: `app.getPath('userData')`
      encryptionKey: '12345', // encryption key, default: undefined
      keypath: {
        userInfo: 'user.userInfo',
        friendList: 'friend.friendList'
      },
      whitelist: [
        'UPDATE_USER_INFO',
        'CLEAR_USER_INFO',
        'ADD_FRIEND',
        'REMOVE_FRIEND'
      ]
    })
  ]
})
```
Or subscribe it when you need it and unsubscribe it when you don't need it
```javascript
// in main process
import store from './src/store/index'
import { configure } from 'vuex-electron-persisted-state'

let userInfoPersisted
let friendListPersisted

ipcMain.on('login-success', () => {
  userInfoPersisted = configure(store, {
    name: 'user-info',
    keypath: {
      userInfo: 'user.userInfo'
    },
    whitelist: [
      'UPDATE_USER_INFO',
      'CLEAR_USER_INFO'
    ],
    afterinit () {
      webContents.getAllWebContents().forEach((item) => {
        item.send('sync-vuex')
      })
    }
  })
  friendListPersisted = configure(store, {
    name: 'friend-list',
    keypath: {
      friendList: 'friend.friendList'
    },
    whitelist: [
      'ADD_FRIEND',
      'REMOVE_FRIEND'
    ],
    afterinit () {
      webContents.getAllWebContents().forEach((item) => {
        item.send('sync-vuex')
      })
    }
  })
})

ipcMain.on('logout', () => {
  userInfoPersisted.unsubscribe() // unsubscribe
  friendListPersisted.unsubscribe() // unsubscribe
})

```

## Introduction

This plugin is based on [electron-store](https://www.npmjs.com/package/electron-store), so it supports all electron-store initial options. There are some other options you should configure.

* **blacklist** and **whitelist** {String[]|Function} You can pass in an array of strings or a filter function to determine whether you want to perform persistence or not.
* **keypath** {Object} Configure the key to be stored and property path of the corresponding state to be persisted in the form of key-value. If not configured, all the state will be persisted as 'config' key.
* **afterinit** {Function} Execute after initialization.
