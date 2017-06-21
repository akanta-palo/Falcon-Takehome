# Falcon-Takehome
JS
// init Models
import {
  createStore,
  applyMiddleware,
  compose,
  combineReducers
} from 'redux'

import createSagaMiddleware from 'redux-saga'
import each from 'lodash/each'
import flatten from 'lodash/flatten'
import merge from 'lodash/merge'

import { reducer as formReducer } from 'redux-form'
import { routerReducer } from 'react-router-redux'

import extractModelReducers from './extract-model-reducers'
import extractModelEffects from './extract-model-effects'

export default function (models) {
  // create saga middleware
  const sagaMiddleware = createSagaMiddleware()

  // combine reducers and effects
  const reducer = combineModelReducers(models)
  const effects = combineModelEffects(models)

  // register saga middleware
  let store = createStore(reducer, applyMiddleware(sagaMiddleware))

  // *********************************************************
  /* develblock:start */
  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose
  store = createStore(reducer, composeEnhancers(
    applyMiddleware(sagaMiddleware)
  ))
  /* develblock:end */
  // *********************************************************

  // run saga
  sagaMiddleware.run(effects)

  // return redux store
  return store
}

// combine reducers from models
function combineModelReducers (models) {
  const reducerMap = {}

  each(models, m => {
    reducerMap[m.namespace] = extractModelReducers(m)
  })

  const reducersWithReduxForm = merge(reducerMap, {
    form: formReducer,
    routing: routerReducer
  })
  return combineReducers(reducersWithReduxForm)
}

// combine effects from models
function combineModelEffects (models) {
  const watchers = []

  each(models, m => {
    watchers.push(extractModelEffects(m))
  })

  const flattenedWatchers = flatten(watchers)

  return function* () { yield flattenedWatchers }
}

// init Reducer
import { createStore, applyMiddleware, compose } from 'redux'
import createSagaMiddleware from 'redux-saga'

// local reducers and sagas
import reducer from '../reducers'
import saga from '../sagas'

// create saga middleware
const sagaMiddleware = createSagaMiddleware()

// register saga middleware
let store = createStore(reducer, applyMiddleware(sagaMiddleware))

// *********************************************************
/* develblock:start */
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose
store = createStore(reducer, composeEnhancers(
  applyMiddleware(sagaMiddleware)
))
/* develblock:end */
// *********************************************************

// run saga
sagaMiddleware.run(saga)

export { store }

//extract effects
import { put, call, takeEvery } from 'redux-saga/effects'
import { hashHistory } from 'react-router'
import each from 'lodash/each'

export default function ({
  namespace,
  effects,
  watchers = []
}) {
  const simplePut = (type, payload) => {
    // call within same model should not use universal type
    const namespaceRegExp = new RegExp(`^${namespace}/`)
    if (namespaceRegExp.test(type)) {
      throw new Error(`Please check type: '${type}'.
        UniversalType is not allowed in calling within same model.
        Please use local type without namesapce: '${namespace}'.
      `)
    }

    const universalType = `${namespace}/${type}`
    return put({type: universalType, payload})
  }

  each(effects, (v, k) => {
    function* falconEffectFunction (action) {
      yield v(action, {simplePut, put, call, navTo: hashHistory.push})
    }

    function* watcher () {
      yield takeEvery(`${namespace}/${k}`, falconEffectFunction)
    }

    watchers.push(watcher())
  })

  return watchers
}

//extract reducers
import { handleActions } from 'redux-actions'
import mapKeys from 'lodash/mapKeys'

export default function ({
  namespace,
  state,
  reducers = {}
}) {
  const namespacedReducers = mapKeys(reducers, (v, k) => {
    return `${namespace}/${k}`
  })

  return handleActions(namespacedReducers, state)
}

// structure of model
import { get, getForexPostLogin } from '../services/forex'

import { ERROR_500_DESCRIPTION, UpdateToken } from 'utils/common.js'

export default {
  namespace: 'forex',
  state: {
    lastInput: 'base',
    amount: '1000.00',
    pending: true,
    quoteCurrency: 'AUD',
    errorMessage: ''
  },
  reducers: {
    set: (state, action) => {
      const { payload } = action
      return {...state, ...payload}
    },
    setLastInput: (state, { payload }) => {
      const {amount, lastInput} = payload
      return {...state, amount, lastInput}
    },
    resetAmount: (state, { payload }) => {
      window.sessionStorage.setItem('baseAmount', '1000.00')
      return {...state, amount: payload, lastInput: 'base'}
    },
    updateCountry: (state, { payload }) => {
      return {...state, country: payload}
    },
    resetQuoteCurrency: (state, { payload }) => {
      return {...state, quoteCurrency: payload }
    },
    setErrorMessage: (state, { payload }) => {
      return {...state, errorMessage: payload }
    }
  },
  effects: {
    *fetch (action, { call, simplePut, put }) {
      try {
        const { payload: currency } = action
        const res = yield call(get, currency)
        const { status } = res

        if (status === 200) {
          const json = yield res.json()
          yield simplePut('set', json)
          yield put({type: 'notification/clear', payload: {type: 'forex'}})
        } else if (status >= 400 && status < 500) {
          const json = yield res.json()
          const { message } = json
          yield put({type: 'notification/set', payload: {message, type: 'forex'}})
        } else if (status === 500) {
          yield put({type: 'notification/set', payload: {message: ERROR_500_DESCRIPTION, type: 'forex'}})
        }
      } catch (error) {
        yield put({type: 'notification/set', payload: {message: 'Please note that we are currently experiencing some technical difficulties. Please try again later.', type: 'forex'}})
      }
    },

    *fetchPostLogin (action, { call, simplePut, put }) {
      try {
        const { payload: {currency, token} } = action
        const res = yield call(getForexPostLogin, {currency, token})
        const { status } = res

        if (status === 200) {
          const json = yield res.json()
          yield simplePut('set', json)
          yield put({type: 'notification/clear', payload: {type: 'forex'}})
          yield UpdateToken(res)
        } else if (status >= 400 && status < 500) {
          const json = yield res.json()
          const { message } = json
          yield put({type: 'notification/set', payload: {message: message, type: 'forex'}})
        } else if (status === 500) {
          yield put({type: 'notification/set', payload: {message: ERROR_500_DESCRIPTION, type: 'forex'}})
        }
      } catch (error) {
        yield put({type: 'notification/set', payload: {message: 'Please note that we are currently experiencing some technical difficulties. Please try again later.', type: 'forex'}})
      }
    }
  }
}

// example of app
// -----------------------------------------------------------------------------
// polyfill
import 'babel-polyfill'
import 'whatwg-fetch'

// -----------------------------------------------------------------------------
// react & redux
import React from 'react'
import { render } from 'react-dom'
import { Router, Route, hashHistory } from 'react-router'
import { Provider } from 'react-redux'

// new way to create store (falcon way: by model)

import transferModel from 'models/transfer.js'
import profileModel from 'models/profile'
import forexModel from 'models/forex'
import specificationModel from 'models/specification'
import notificationModel from 'models/notification'
import routeStorageModel from 'models/routeStorage'
// -----------------------------------------------------------------------------
// components
import '../assets/css/reset.css'

// routes
import MainRoute from 'routes/desktop-main'
import UpdateProfileRoute from 'routes/desktop-updateProfile'
import SetProfileRoute from 'routes/desktop-setProfile'
import SetTransferRoute from 'routes/desktop-setTransfer'
import Transfer from 'routes/desktop-transfer'
import NewRecipientRoute from 'routes/desktop-addRecipient'
import ChangePasswordRoute from 'routes/desktop-changePassword'

// to reset form in case of browser back and forth
import { reset } from 'redux-form'
import { increaseSessionTimeoutCounter, getSessionTimeoutCounter, resetSessionTimeoutCounter,
  maxSessionTimeout, maxSessionTimeoutResponseWait } from 'utils/common.js'
import SessionTimeoutOverlay from 'components/overlays/session-Timeout'

import { TrackDashboardPages } from 'utils/aaTagging.js'

import initModels from 'utils/initModels'
const store = initModels([
  profileModel,
  forexModel,
  specificationModel,
  notificationModel,
  transferModel,
  routeStorageModel
])

// redirecting user if they're mobile to mobile site
if (/ip(hone|od)|android.*(mobile)|blackberry.*applewebkit/i.test(navigator.userAgent)) {
  window.location.href = './mobile.html'
}
// *********************************************
// picking up all the profile data from login page
// const profile = JSON.parse(window.sessionStorage.getItem('profile'))
const baseAmount = window.sessionStorage.getItem('baseAmount')
const lastInput = window.sessionStorage.getItem('lastInput')
const foreignCurrency = window.sessionStorage.getItem('foreignCurrency')
const token = window.sessionStorage.getItem('token')
let transferReviewDetails = window.sessionStorage.getItem('transferReviewDetails')
const partyId = window.sessionStorage.getItem('partyId')

// const { personal_detail: {partyId} } = profile
let countryIso
switch (foreignCurrency) {
  case 'IDR':
    countryIso = 'ID'
    break
  case 'INR':
    countryIso = 'IN'
    break
  case 'GBP':
    countryIso = 'GB'
    break
  case 'PHP':
    countryIso = 'PH'
    break
  case 'USD':
    countryIso = 'US'
    break
  case 'MYR':
    countryIso = 'MY'
    break
  case 'HKD':
    countryIso = 'HK'
    break
  default :
    countryIso = 'AU'
    break
}
store.dispatch({type: 'profile/setToken', payload: token})
store.dispatch({type: 'profile/retrieveProfile', payload: {partyId, token}})
store.dispatch({type: 'profile/retrieveTransferLimits', payload: {token}})
store.dispatch({type: 'transfer/retrievePayees', payload: {partyId, token}})
store.dispatch({type: 'transfer/retrieveTransferHistory', payload: {partyId, token}})
store.dispatch({type: 'transfer/retrieveBanksList', payload: {countryIso: countryIso, token}})

if (!token) {
  window.location.href = './index.html'
}

// -----------------------------------------------------------------------------
// initial action
store.dispatch({type: 'forex/fetchPostLogin', payload: {currency: foreignCurrency || 'AUD', token}})
store.dispatch({type: 'specification/fetch'})
// if status is wipe out -> user refreshes
if (transferReviewDetails) {
  transferReviewDetails = JSON.parse(transferReviewDetails)
  const { name: senderBank } = transferReviewDetails
  store.dispatch({type: 'profile/setSenderBank', payload: senderBank})
}
if (baseAmount && lastInput) {
  store.dispatch({type: 'forex/setLastInput', payload: { amount: baseAmount, lastInput: lastInput }})
}
store.dispatch({type: 'profile/retrieveTransferLimits', payload: {token: token}})

// session
document.onclick = (e) => {
  // refresh the session timeout counter on every click
  const sessionTimeoutCounter = getSessionTimeoutCounter()
  if (sessionTimeoutCounter < (maxSessionTimeout + maxSessionTimeoutResponseWait)) {
    // check if overlay is displayed and user hasn't responded yet
    const isSessionTimeout = store.getState().profile.isSessionTimeout
    // do not reset the counter if session is alreayd timed out
    if (!isSessionTimeout) {
      resetSessionTimeoutCounter()
    }
  }
}

// All page level AA tagging
hashHistory.listen(location => {
  // clear all the server errors
  if (location.action === 'POP' && location.pathname === '/') {
    store.dispatch({type: 'notification/clear', payload: {type: 'profile'}})
    store.dispatch({type: 'notification/clear', payload: {type: 'transfer'}})
  }

  // AA tagging call
  if (location.action === 'POP') {
    TrackDashboardPages({location, store})
  }
})

const routes = <div>
  <Route path='/' component={MainRoute} />
  <Route path='/add-recipient' component={NewRecipientRoute} />
  <Route path='/update-profile' component={UpdateProfileRoute} />
  <Route path='/set-profile' component={SetProfileRoute} />
  <Route path='/set-transfer' component={SetTransferRoute} />
  <Route path='/transfer' component={Transfer} />
  <Route path='/change-password' component={ChangePasswordRoute} />
</div>

let interval

class App extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      sessionTimedOut: false
    }

    this.onUnload = this.onUnload.bind(this) // if you need to bind callback to this
  }

  onUnload (event) { // the method that will be used for both add and remove event
    const location = window.location.href
    if ((location.indexOf('set-transfer') > 0 || location.indexOf('set-profile') > 0 ||
      location.indexOf('add-recipient') > 0 || location.indexOf('change-password') > 0 ||
      location.indexOf('update-profile') > 0) &&
      (!this.state.sessionTimedOut && !store.getState().profile.isSessionTimeout)) {
      event.returnValue = 'Data hasn\'t been saved! Please do not click back or refresh!'
    }
    // refresh the session counter
    resetSessionTimeoutCounter()
  }

  onPopState (event) {
    // this method is to clear the form values and reset the form in case user use brower's back/forward button
    store.dispatch({type: 'profile/resetProfile'})
    store.dispatch(reset('updateProfileForm'))
  }

  redirectToPublic () {
    if (!token) {
      hashHistory.push('/')
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.isSessionTimeout !== this.props.isSessionTimeout) {
      this.setState({ sessionTimedOut: nextProps.isSessionTimeout })
    }
  }

  componentDidMount () {
    window.addEventListener('beforeunload', this.onUnload.bind(this))
    window.addEventListener('popstate', this.onPopState)

    interval = setInterval(() => {
      const sessionTimeoutCounter = getSessionTimeoutCounter()
      // check for 401 session end here first
      const session401Error = window.sessionStorage.getItem('Session401Error')
      if (session401Error === 'true') {
        window.sessionStorage.clear()
        store.dispatch({type: 'profile/setSessionTimeout', payload: { timeoutFlag: true }})
      }
      // console.log(sessionTimeoutCounter)
      if (sessionTimeoutCounter > maxSessionTimeout) {
        store.dispatch({type: 'profile/setSessionTimeout', payload: { timeoutFlag: true }})
        this.setState({sessionTimedOut: true})
      } else {
        // check session storage, if overlay is already displayed and user responded with 'Stay Login'
        const userResponse = window.sessionStorage.getItem('SessionStayLogin')
        if (userResponse) {
          if (userResponse === 'yes') {
            this.setState({sessionTimedOut: false})
          }
          window.sessionStorage.removeItem('SessionStayLogin')
        }
      }
      increaseSessionTimeoutCounter()
    }, 1000)
  }

  componentWillUnmount () {
    clearInterval(interval)
    hashHistory.push('/')
    window.removeEventListener('beforeunload', this.onUnload.bind(this))
    window.removeEventListener('popstate', this.onPopState)
  }

  render () {
    const showOverlay = this.state.sessionTimedOut ? '' : 'none'
    return (<div>
      <Provider store={store}>
        <div>
          <div style={{'display': showOverlay}}>
            <SessionTimeoutOverlay />
          </div>
          <Router history={hashHistory}>
            {token
              ? routes
              : <div>Loading ...</div>
            }
          </Router>
        </div>
      </Provider>
    </div>
    )
  }
}

render(<App isSessionTimeout={store.getState().profile.isSessionTimeout} />, document.getElementById('app'))

