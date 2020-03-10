function Mvvm(options = {}) {
    this.$options = options
    let data = this._data = this.$options.data
    //数据劫持
    observe(data)
    //console.log('this is',this)
    for (let key in data) {
        Object.defineProperty(this,key,{
            configurable:true,
            get() {
                return this._data[key]
            },
            set(newVal) {
                console.log('执行了set');
                this._data[key] = newVal
            }
        })
    }
    // 初始化computed,将this指向实例
    initComputed.call(this);
    new Compile(options.el,this)
    // 所有事情处理好后执行mounted钩子函数
    options.mounted.call(this); // 这就实现了mounted钩子函数
}

function observe(data) {
    // 如果不是对象的话就直接return掉
    // 防止递归溢出
    if (!data || typeof data !== 'object') return;
    return new Observe(data);
}

function Observe(data) {
    // 所谓数据劫持就是给对象增加get,set
    // 先遍历一遍对象再说
    let dep = new Dep();
    for(let key in data) {
        let val = data[key]
        observe(val) //递归继续向下找，实现深度的数据劫持
        Object.defineProperty(data,key,{
            configurable:true,
            get() {
                Dep.target && dep.addSub(Dep.target);
                // 将watcher添加到订阅事件中 [watcher]
                return val
            },
            set(newVal) {
                if(val===newVal) {  // 设置的值和以前值一样就不理它
                    return
                }
                val = newVal // 如果以后再获取值(get)的时候，将刚才设置的值再返回去
                observe(newVal) // 当设置为新值后，也需要把新值再去定义成属性
                dep.notify();   // 让所有watcher的update方法执行即可
            }
        })
    }
}

//数据编译
// 创建Compile构造函数
function Compile(el,vm) {
    console.log('调用compile');
    // 将el挂载到实例上方便调用
    vm.$el = document.querySelector(el)
    // 在el范围里将内容都拿到，当然不能一个一个的拿
    // 可以选择移到内存中去然后放入文档碎片中，节省开销
    //https://developer.mozilla.org/zh-CN/docs/Web/API/Document/createDocumentFragment
    let fragment = document.createDocumentFragment()
    let child
    while (child = vm.$el.firstChild) {
        //console.log(vm.$el.firstChild)
        fragment.appendChild(child);    // 此时将el中的内容放入内存中
    }
    //console.log(fragment);

    function replace(fragment) {
        console.log(Array.from(fragment.childNodes));
        Array.from(fragment.childNodes).forEach(node=>{
            let text = node.textContent
            let reg = /\{\{(.*?)\}\}/g; // 正则匹配{{}}
            if(node.nodeType===3&&reg.test(text)) {
                // function replaceText() {
                //     node.textContent = text.replace(reg,(matched, placeholder)=>{
                //         console.log('asddas',placeholder);
                //         new Watcher(vm,placeholder,replaceText) // 监听变化，进行匹配替换内容
                //
                //         return placeholder.split('.').reduce((val,key)=>{
                //             return val[key]
                //         },vm)
                //     })
                // }
                // replaceText()
                let arr = RegExp.$1.split('.');
                console.log(arr)
                let val = vm
                arr.forEach(key=>{
                    if(val[key]){
                        val = val[key] // 如this.a.b
                    }
                })
                //console.log('!!!!!',val)
                console.log(text.replace(reg, val));
                node.textContent = text.replace(reg, val).trim();
                // 监听变化
                // 给Watcher再添加两个参数，用来取新的值(newVal)给回调函数传参
                new Watcher(vm,RegExp.$1,newVal=>{
                    node.textContent = text.replace(reg, newVal).trim();
                })
            }
            //双向数据绑定
            if(node.nodeType ===1) { //元素节点
                let nodeAttr = node.attributes //获取dom上的所有属性,是个类数组
                Array.from(nodeAttr).forEach(attr=>{
                    let name = attr.name // v-model  type
                    let exp = attr.value // c        text
                    if(name.includes('v-')){
                        node.value = vm[exp]
                    }
                    //监听变化
                    new Watcher(vm,exp,function (newVal) {
                        node.value = newVal
                    })

                    node.addEventListener('input',e =>{
                        let newVal = e.target.value
                        // 相当于给this.c赋了一个新值
                        // 而值的改变会调用set，set中又会调用notify，notify中调用watcher的update方法实现了更新
                        vm[exp] = newVal
                    })
                })
            }
            // 如果还有子节点，继续递归replace
            if (node.childNodes && node.childNodes.length) {
                replace(node);
            }
        })
    }
    replace(fragment) // 替换内容
    vm.$el.appendChild(fragment) // 再将文档碎片放入el中
}

//发布订阅模式
function Dep() {
    this.subs = [] //订阅数组
}

Dep.prototype = {
    addSub(sub) {
        this.subs.push(sub)
    },
    notify() {
        // 绑定的方法，都有一个update方法
        this.subs.forEach(sub=>sub.update())
    }
}

// 监听函数
// 通过Watcher这个类创建的实例，都拥有update方法
function Watcher(vm, exp, fn) {
    this.fn = fn
    this.vm = vm
    this.exp = exp
    // 添加一个事件
    // 这里我们先定义一个属性
    Dep.target = this
    let arr = exp.split('.')
    let val = vm
    arr.forEach(key=>{ // 取值
        if(val[key]){
            val = val[key] // 获取到this.a.b，默认就会调用get方法
        }
    })
    Dep.target = null
}

Watcher.prototype.update = function() {
    let arr = this.exp.split('.')
    let val = this.vm
    arr.forEach(key=>{
        if(val[key]){
            val = val[key] // 获取到this.a.b，默认就会调用get方法
        }
    })
    this.fn(val)
}

// let watcher = new Watcher(()=>console.log('创建watcher实例'))
// let dep = new Dep()
// dep.addSub(watcher)
// dep.addSub(watcher)
// dep.notify()

//computed(计算属性) && mounted(钩子函数)
function initComputed() {
    let vm = this
    let computed = this.$options.computed // 从options上拿到computed属性   {sum: ƒ, noop: ƒ}
    Object.keys(computed).forEach(key=>{
        Object.defineProperty(vm,key,{
            // 这里判断是computed里的key是对象还是函数
            // 如果是函数直接就会调get方法
            // 如果是对象的话，手动调一下get方法即可
            // 如：sum() {return this.a + this.b;},他们获取a和b的值就会调用get方法
            // 所以不需要new Watcher去监听变化了
            get: typeof computed[key] === 'function' ? computed[key] : computed[key].get,
            set(newVal) {
            }
        })
    })
}


























