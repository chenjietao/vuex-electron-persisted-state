const Store = require('electron-store')
const at = require('lodash/fp/at')
const merge = require('lodash/fp/merge')
const mergeWith = require('lodash/fp/mergeWith')

const CONFIG_NAME = 'config'
const CONFIG_KEY = 'state'
const TEST_KEY = 'test'

class VuexElectronPersistedState {
  /**
   * 持久化state特定字段到本地配置文件
   * - 常规初始化配置可参考electron-store文档(主要需要设置name, cwd, encryptionKey, fileExtension等)
   * - 除了electron-store文档的字段，还增加以下配置:
   * - - blacklist: {String[]|Function} mutation黑名单，若配置，该mutation提交时不会触发持久化配置，参考vuex-electron
   * - - whitelist: {String[]|Function} mutation白名单，若配置，仅当该mutation提交时才触发持久化配置，参考vuex-electron
   * - - keypath: {Object} 以 key-value 的形式配置要持久化的key和对应的state属性路径
   * - - afterinit: {Function} 初始化完成之后执行
   * @param {Object} options 初始化选项
   * @param {Object} store vuex store对象
   */
  constructor (options, store) {
    this.store = store

    this.options = merge({}, options)
    delete this.options.keypath
    delete this.options.blacklist
    delete this.options.whitelist
    delete this.options.afterinit

    if (!this.options.name) {
      // 配置文件的名称(不包含扩展名)
      this.options.name = CONFIG_NAME
    }
    this.storage = this.createStorage()

    if (typeof options.afterinit === 'function') {
      this.afterinit = options.afterinit
    } else {
      this.afterinit = null
    }

    if (!options.keypath) {
      this.keyList = [CONFIG_KEY]
      this.pathList = ['']
    } else {
      this.keyList = Object.keys(options.keypath)
      this.pathList = this.keyList.map(key => options.keypath[key])
    }

    this.blacklist = this.loadFilter(options.blacklist)
    this.whitelist = this.loadFilter(options.whitelist)

    this.unsubscribe = null
  }

  createStorage () {
    return new Store(this.options)
  }

  loadFilter (filter, name) {
    if (!filter) {
      return null
    } else if (Array.isArray(filter)) {
      return this.filterInArray(filter)
    } else if (typeof filter === 'function') {
      return filter
    } else {
      throw new Error(`[VuexElectronPersistedState] options "${name}" should be Array or Function. Please, read the "vuex-electron" docs.`)
    }
  }

  filterInArray (list) {
    return (mutation) => {
      return list.includes(mutation.type)
    }
  }

  getConfig (key) {
    return this.storage.get(key)
  }

  setConfig (key, config) {
    this.storage.set(key, config)
  }

  checkStorage () {
    try {
      this.storage.set(TEST_KEY, TEST_KEY)
      this.storage.get(TEST_KEY)
      this.storage.delete(TEST_KEY)
    } catch {
      throw new Error('[VuexElectronPersistedState] Storage is not valid. Please, read the "electron-store" docs.')
    }
  }

  arrayMerge (objValue, srcValue) {
    if (Array.isArray(objValue)) {
      return objValue.concat(srcValue)
    }
  }

  loadInitialConfig () {
    // 将本地已持久化的配置替换到state中
    let canMerge = false
    let mergeState = merge({}, this.store.state)
    this.keyList.forEach((key, index) => {
      const pathchain = this.pathList[index]
      const config = this.getConfig(key)
      if (config) {
        let state = {}
        let tmpObj = state
        pathchain.split('.').forEach((key, index, array) => {
          if (index !== array.length - 1) {
            tmpObj[key] = {}
            tmpObj = tmpObj[key]
          } else if (key) {
            tmpObj[key] = config
          } else if (index === 0) {
            state = config
          }
        })
        canMerge = true
        mergeState = mergeWith(mergeState, state, this.arrayMerge)
      }
    })
    if (canMerge) {
      this.store.replaceState(mergeState)
    }
  }

  subscribeOnChanges () {
    this.unsubscribe = this.store.subscribe((mutation, state) => {
      if (this.blacklist && this.blacklist(mutation)) return
      if (this.whitelist && !this.whitelist(mutation)) return

      this.keyList.forEach((key, index) => {
        const pathchain = this.pathList[index]
        let config = state
        if (pathchain.length > 0) {
          config = at(state, pathchain)[0]
        }
        this.setConfig(key, config)
      })
    })
    if (typeof this.afterinit === 'function') {
      this.afterinit()
    }
  }
}

// 作为Vuex Store构造函数的插件使用，在Store初始化时就开始持久化状态
module.exports.plugin = (options = {}) => (store) => {
  const persistedState = new VuexElectronPersistedState(options, store)
  persistedState.checkStorage()
  persistedState.loadInitialConfig()
  persistedState.subscribeOnChanges()
}

// 单独执行函数，用于当持久化状态需要在某个时间以后才开始时，可以使用this.unsubscribe()取消订阅，需要传入store对象作为第1个参数
module.exports.configure = (store, options = {}) => {
  const persistedState = new VuexElectronPersistedState(options, store)
  persistedState.checkStorage()
  persistedState.loadInitialConfig()
  persistedState.subscribeOnChanges()
  return persistedState
}
