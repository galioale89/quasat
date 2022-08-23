class ListInput {
    constructor(mongoose, app) {
        this.app = app;
        this.mongoose = mongoose;
    }

    async getClients(id, vendedor) {
        var sql = {}
        this.app.get('/clients', (req, res) => {
            const client = this.mongoose.model('cliente')

            const allClients = new Promise((resolve, reject) => {
                if (vendedor){
                    sql = {user: id, vendedor: vendedor}
                }else{
                    sql = {user: id}
                }
                console.log(data)
                client.find(sql, (err, data) => {
                    const clients = data.map((data) => {
                        return {
                            name: data.nome,
                        }
                    })
                    if (clients == null || typeof projects == undefined) {
                        reject('Não foram encontrados clientes')
                    } else {
                        let listName = clients.filter(a => {
                            return !this[JSON.stringify(a)] && (this[JSON.stringify(a)] = true)  
                        },Object.create(null));
                        resolve(listName)
                    }
                })
            })

            allClients.then((result) => {
                res.send(result)
            }).catch((err) => {
                console.log('Deu erro ' + err)
            })
        })
    }
}

module.exports = ListInput;