import {
  mockMsgList,
  isDev,
  initMarkdown,
  initClipboard,
} from './utils.js'

let api
let threadContainer = null
let md

const app = Vue.createApp({
  data() {
    return {
      message: "",
      currentAssistantMessage: '',
      messageList: [],
      role: '',
      loading: false,
      controller: null,
      useLight: true,
      activePromptName: '自由模式',
      systemRolePrompt: '',
      search: '',
      prompts: [
        {
          name: '自由模式',
          prompt: ''
        },
        {
          name: '电脑专家',
          prompt: '你作为计算机专家,提供IT支持'
        },
        {
          name: '代码专家',
          prompt: '你来协助代码实现，只输出代码'
        },
        {
          name: '润色文档',
          prompt: '你来润色文档'
        },
        {
          name: '翻译助手',
          prompt: '你作为翻译员，中英互译'
        },
        {
          name: '英语矫正',
          prompt: '你来做英语矫正'
        },
        {
          name: 'SQL Translator',
          prompt: 'Translate my natural language query into SQL'
        },
      ]
    }
  },
  methods: {
    resetThread() {
      this.messageList = []
    },
    handleKeydown(e) {
      if (e.isComposing || e.shiftKey) {
        return
      }
      if (e.key === 'Enter') {
        this.onSend()
      }
    },
    onSend() {
      if (this.loading) return
      this.scrollEnd()
      this.messageList.push({
        role: 'user',
        content: this.message,
      })
      this.messageList.push({
        role: 'assistant',
        content: '',
      })
      this.requestWithLatestMessage()
    },
    async requestWithLatestMessage() {
      this.loading = true
      this.message = ''
      this.currentAssistantMessage = ''
      try {
        const controller = new AbortController()
        this.controller = controller
        const messages = [...this.messageList]
        if (this.systemRolePrompt) {
          messages.unshift({
            role: 'system',
            content: this.systemRolePrompt
          })
        }
        const response = await fetch(api, {
          method: 'POST',
          body: JSON.stringify({
            messages,
          }),
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(response.statusText)
        }
        const data = response.body
        if (!data) {
          throw new Error('No data')
        }
        const reader = data.getReader()
        const decoder = new TextDecoder('utf-8')
        let done = false

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          isDev && console.log('debug', +new Date(), value, readerDone)
          if (value) {
            let char = decoder.decode(value)
            if (char === '\n' && this.currentAssistantMessage.endsWith('\n')) {
              continue
            }
            if (char) {
              this.currentAssistantMessage += char
            }
          }
          done = readerDone
        }
      } catch (e) {
        console.error(e)
        this.loading = false
        this.controller = null
        return
      }
      this.resEnd()
    },
    archiveCurrentMessage() {
      if (this.currentAssistantMessage) {
        console.log('archiveCurrentMessage')
        this.setLastMsgContent()
        this.currentAssistantMessage = ''
        this.loading = false
        this.controller = null
      } else {
        this.currentAssistantMessage = '...'
      }
    },
    stopStreamFetch() {
      if (this.controller) {
        this.controller.abort()
        this.archiveCurrentMessage()
      }
    },
    setLastMsgContent() {
      const lastMsg = this.messageList[this.messageList.length - 1]
      if (lastMsg.role === 'assistant') {
        lastMsg.content = this.currentAssistantMessage
      }
    },
    resEnd() {
      if (this.currentAssistantMessage) {
        this.currentAssistantMessage = ''
        this.loading = false
        this.controller = null
      }
    },
    scrollEnd() {
      setTimeout(() => {
        threadContainer && threadContainer.scrollTo({top: threadContainer.scrollHeight, behavior: 'smooth'})
      }, 100)
    },
    renderMD(content) {
      return md.render(content);
    },
    toggleColor() {
      this.useLight = !this.useLight
    },
    onInput() {
      const {inputRef} = this.$refs
      inputRef.style.height = 'auto'; // 当删减输入时，scrollHeight 重置
      inputRef.style.height = inputRef.scrollHeight + 'px';
    },
    setPromot({prompt, name}) {
      this.activePromptName = name
      this.systemRolePrompt = prompt
      console.info('activePromptName', name)
      this.messageList = []
    },
    onSearchEnter() {
      const cur = this.filteredItems[0]
      this.search = ''
      if (cur) {
        this.setPromot(cur)
        this.$refs.inputRef.focus();
      }
    }
  },
  computed: {
    colorScheme() {
      return this.useLight ? 'light' : 'dark'
    },
    filteredItems() {
      return this.prompts.filter(
          i => i.name.toLowerCase().includes(this.search.toLowerCase())
      )
    }
  },
  watch: {
    'currentAssistantMessage': function (val, oldVal) {
      if (val) {
        if (!oldVal) {
          this.setLastMsgContent()
        } else {
          this.messageList[this.messageList.length - 1].content = val
          this.scrollEnd()
        }
      }
    }
  },
  mounted() {
    if (isDev) {
      api = 'http://localhost:3000/api/generate'
      this.messageList = mockMsgList
    } else {
      const params = new URLSearchParams(location.search)
      const apiParam = params.get('api')
      if (apiParam) {
        api = apiParam
        localStorage.setItem('api', apiParam)
        alert('设置 api 成功')
      } else {
        const apiCache = localStorage.getItem('api');
        if (apiCache) {
          api = apiCache
        } else {
          alert('请指定 api，形如：https://chatgpt.oaker.bid/?api=YOUR_SERVICE_DOMAIN/api/generate')
        }
      }
    }
    md = initMarkdown()
    initClipboard('.copy-btn')
    threadContainer = document.querySelector('.thread-container')
  }
})
app.mount('#app')
