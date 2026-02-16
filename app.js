class StorageManager {
    constructor() {
        this.data = {
            produtos: [],
            movimentacoes: [],
            configuracoes: {
                ultimoId: 0
            }
        };
        this.loadFromLocalStorage();
    }

    generateId() {
        this.data.configuracoes.ultimoId++;
        this.save();
        return this.data.configuracoes.ultimoId;
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('gestao_estoque_data');
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                console.error('Erro ao carregar dados:', e);
            }
        }
    }

    save() {
        localStorage.setItem('gestao_estoque_data', JSON.stringify(this.data));
    }

    // Produtos
    adicionarProduto(produto) {
        produto.id = this.generateId();
        produto.dataCadastro = new Date().toISOString();
        produto.ultimaAtualizacao = new Date().toISOString();
        this.data.produtos.push(produto);
        this.save();
        return produto;
    }

    atualizarProduto(id, atualizacoes) {
        const produto = this.data.produtos.find(p => p.id === id);
        if (produto) {
            Object.assign(produto, atualizacoes, { ultimaAtualizacao: new Date().toISOString() });
            this.save();
            return produto;
        }
        return null;
    }

    deletarProduto(id) {
        this.data.produtos = this.data.produtos.filter(p => p.id !== id);
        this.save();
    }

    getProdutos() {
        return this.data.produtos;
    }

    getProduto(id) {
        return this.data.produtos.find(p => p.id === id);
    }

    // Movimentações
    adicionarMovimentacao(movimentacao) {
        movimentacao.data = new Date().toISOString();
        this.data.movimentacoes.push(movimentacao);
        this.save();
    }

    getMovimentacoes() {
        return this.data.movimentacoes;
    }

    // Geral
    exportarDados() {
        return JSON.stringify(this.data, null, 2);
    }

    importarDados(jsonString) {
        try {
            const novosDados = JSON.parse(jsonString);
            if (!novosDados.produtos || !novosDados.movimentacoes || !novosDados.configuracoes) {
                throw new Error('Estrutura JSON inválida');
            }
            this.data = novosDados;
            this.save();
            return true;
        } catch (e) {
            console.error('Erro ao importar dados:', e);
            return false;
        }
    }
}

class App {
    constructor() {
        this.storage = new StorageManager();
        this.editandoProdutoId = null;
        this.contagemEmAndamento = false;
        this.contagemDados = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.mostrarSecao('dashboard');
        this.upadateDashboard();
    }

    setupEventListeners() {
        // Menu
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const secao = btn.dataset.section;
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mostrarSecao(secao);
            });
        });

        // Produtos
        document.getElementById('btnNovoProduto').addEventListener('click', () => this.abrirModalProduto());
        document.getElementById('formProduto').addEventListener('submit', (e) => this.salvarProduto(e));
        document.getElementById('btnCancelar').addEventListener('click', () => this.fecharModalProduto());
        document.querySelector('.close').addEventListener('click', () => this.fecharModalProduto());
        document.getElementById('pesquisaProduto').addEventListener('input', () => this.atualizarTabelaProdutos());
        document.getElementById('filtroCategoria').addEventListener('change', () => this.atualizarTabelaProdutos());

        // Movimentações
        document.getElementById('formMovimentacao').addEventListener('submit', (e) => this.registrarMovimentacao(e));
        document.getElementById('filtroData').addEventListener('change', () => this.atualizarTabelaMovimentacoes());
        document.getElementById('filtroMovTipo').addEventListener('change', () => this.atualizarTabelaMovimentacoes());

        // Balanço
        document.getElementById('btnIniciarContagem').addEventListener('click', () => this.iniciarContagem());
        document.getElementById('btnConcluirContagem').addEventListener('click', () => this.concluirContagem());

        // Lista de Compras
        document.getElementById('btnGerarLista').addEventListener('click', () => this.gerarListaCompras());
        document.getElementById('btnExportarLista').addEventListener('click', () => this.exportarLista());

        // Backup
        document.getElementById('btnExportarBackup').addEventListener('click', () => this.exportarBackup());
        document.getElementById('btnImportarBackup').addEventListener('click', () => {
            document.getElementById('inputImportar').click();
        });
        document.getElementById('inputImportar').addEventListener('change', (e) => this.importarBackup(e));

        // Fechar modal clicando fora
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('modalProduto');
            if (e.target === modal) {
                this.fecharModalProduto();
            }
        });
    }

    // Seções
    mostrarSecao(secaoId) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const secao = document.getElementById(secaoId);
        if (secao) {
            secao.classList.add('active');
            
            // Atualizar dados quando a seção é aberta
            if (secaoId === 'dashboard') this.upadateDashboard();
            else if (secaoId === 'produtos') this.atualizarTabelaProdutos();
            else if (secaoId === 'movimentacoes') {
                this.atualizarSelectProdutos();
                this.atualizarTabelaMovimentacoes();
            }
            else if (secaoId === 'balanco') this.atualizarTabelaBalanco();
        }
    }

    // Dashboard
    upadateDashboard() {
        const produtos = this.storage.getProdutos();
        const movimentacoes = this.storage.getMovimentacoes();

        // Total de produtos
        document.getElementById('totalProdutos').textContent = produtos.length;

        // Total de itens
        const totalItens = produtos.reduce((sum, p) => sum + (parseInt(p.quantidade) || 0), 0);
        document.getElementById('totalItens').textContent = totalItens.toLocaleString('pt-BR');

        // Valor total
        const valorTotal = produtos.reduce((sum, p) => {
            const custo = parseFloat(p.custo) || 0;
            const quantidade = parseInt(p.quantidade) || 0;
            return sum + (custo * quantidade);
        }, 0);
        document.getElementById('valorTotal').textContent = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;

        // Estoque baixo
        const estoqueBaixo = produtos.filter(p => parseInt(p.quantidade) <= parseInt(p.minimo)).length;
        document.getElementById('estoqueBaixo').textContent = estoqueBaixo;

        // Últimas 5 movimentações
        const ultimasMovimentacoes = movimentacoes.slice(-5).reverse();
        this.atualizarTabelaUltimas(ultimasMovimentacoes);
    }

    atualizarTabelaUltimas(movimentacoes) {
        const tbody = document.getElementById('ultimasMovimentacoes');
        if (movimentacoes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma movimentação registrada</td></tr>';
            return;
        }

        tbody.innerHTML = movimentacoes.map(mov => {
            const produto = this.storage.getProduto(mov.produtoId);
            const nomeProduto = produto ? produto.nome : 'Produto desconhecido';
            const data = new Date(mov.data).toLocaleDateString('pt-BR');
            const tipoClass = mov.tipo === 'Entrada' ? 'success' : mov.tipo === 'Ajuste de Inventário' ? 'info' : 'danger';
            return `
                <tr>
                    <td>${nomeProduto}</td>
                    <td><span class="badge ${tipoClass}">${mov.tipo}</span></td>
                    <td>${mov.quantidade}</td>
                    <td>${data}</td>
                    <td>${mov.observacao || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    // Produtos
    abrirModalProduto(produtoId = null) {
        const modal = document.getElementById('modalProduto');
        const titulo = document.getElementById('modalTitulo');
        const form = document.getElementById('formProduto');
        
        form.reset();
        this.editandoProdutoId = produtoId;

        if (produtoId) {
            titulo.textContent = 'Editar Produto';
            const produto = this.storage.getProduto(produtoId);
            if (produto) {
                document.getElementById('prodNome').value = produto.nome;
                document.getElementById('prodCategoria').value = produto.categoria;
                document.getElementById('prodCusto').value = produto.custo;
                document.getElementById('prodVenda').value = produto.venda;
                document.getElementById('prodQuantidade').value = produto.quantidade;
                document.getElementById('prodMinimo').value = produto.minimo;
                document.getElementById('prodDescricao').value = produto.descricao || '';
                document.getElementById('prodDetalhes').value = produto.detalhes || '';
                document.getElementById('prodFoto').value = produto.foto || '';
            }
        } else {
            titulo.textContent = 'Novo Produto';
        }

        modal.classList.add('show');
    }

    fecharModalProduto() {
        document.getElementById('modalProduto').classList.remove('show');
        this.editandoProdutoId = null;
    }

    salvarProduto(e) {
        e.preventDefault();

        const produto = {
            nome: document.getElementById('prodNome').value,
            categoria: document.getElementById('prodCategoria').value,
            custo: parseFloat(document.getElementById('prodCusto').value),
            venda: parseFloat(document.getElementById('prodVenda').value),
            quantidade: parseInt(document.getElementById('prodQuantidade').value),
            minimo: parseInt(document.getElementById('prodMinimo').value),
            descricao: document.getElementById('prodDescricao').value,
            detalhes: document.getElementById('prodDetalhes').value,
            foto: document.getElementById('prodFoto').value
        };

        if (this.editandoProdutoId) {
            this.storage.atualizarProduto(this.editandoProdutoId, produto);
            this.mostrarToast('Produto atualizado com sucesso!', 'success');
        } else {
            this.storage.adicionarProduto(produto);
            this.mostrarToast('Produto criado com sucesso!', 'success');
        }

        this.fecharModalProduto();
        this.atualizarTabelaProdutos();
        this.atualizarSelectProdutos();
        this.upadateDashboard();
    }

    atualizarTabelaProdutos() {
        const pesquisa = document.getElementById('pesquisaProduto').value.toLowerCase();
        const categoria = document.getElementById('filtroCategoria').value;
        const tbody = document.getElementById('tabelaProdutos');

        let produtos = this.storage.getProdutos();

        // Filtros
        produtos = produtos.filter(p => {
            const nomeCerca = p.nome.toLowerCase().includes(pesquisa);
            const categoriaCerca = !categoria || p.categoria === categoria;
            return nomeCerca && categoriaCerca;
        });

        if (produtos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty">Nenhum produto encontrado</td></tr>';
            return;
        }

        tbody.innerHTML = produtos.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${p.nome}</td>
                <td>${p.categoria}</td>
                <td>R$ ${parseFloat(p.custo).toFixed(2).replace('.', ',')}</td>
                <td>R$ ${parseFloat(p.venda).toFixed(2).replace('.', ',')}</td>
                <td><strong>${p.quantidade}</strong></td>
                <td>${p.minimo}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn edit-btn" onclick="app.abrirModalProduto(${p.id})">Editar</button>
                        <button class="action-btn delete-btn" onclick="app.deletarProdutoConfirm(${p.id})">Deletar</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    deletarProdutoConfirm(id) {
        if (confirm('Tem certeza que deseja deletar este produto? Esta ação não pode ser desfeita.')) {
            this.storage.deletarProduto(id);
            this.mostrarToast('Produto deletado com sucesso!', 'success');
            this.atualizarTabelaProdutos();
            this.atualizarSelectProdutos();
            this.upadateDashboard();
        }
    }

    // Movimentações
    atualizarSelectProdutos() {
        const select = document.getElementById('movProduto');
        const produtos = this.storage.getProdutos();
        
        select.innerHTML = '<option value="">Selecione um produto</option>';
        produtos.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.nome} (Est: ${p.quantidade})</option>`;
        });
    }

    registrarMovimentacao(e) {
        e.preventDefault();

        const produtoId = parseInt(document.getElementById('movProduto').value);
        const tipo = document.getElementById('movTipo').value;
        const quantidade = parseInt(document.getElementById('movQuantidade').value);
        const observacao = document.getElementById('movObservacao').value;

        if (!produtoId || !tipo || !quantidade) {
            this.mostrarToast('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        const produto = this.storage.getProduto(produtoId);
        if (!produto) {
            this.mostrarToast('Produto não encontrado', 'error');
            return;
        }

        // Validar estoque negativo
        if (tipo === 'Saída' && (produto.quantidade - quantidade) < 0) {
            this.mostrarToast(`Estoque insuficiente! Disponível: ${produto.quantidade}`, 'error');
            return;
        }

        // Atualizar estoque
        const novaQuantidade = tipo === 'Entrada' 
            ? produto.quantidade + quantidade 
            : produto.quantidade - quantidade;

        this.storage.atualizarProduto(produtoId, { quantidade: novaQuantidade });

        // Registrar movimentação
        this.storage.adicionarMovimentacao({
            produtoId,
            tipo,
            quantidade,
            observacao
        });

        this.mostrarToast(`Movimentação de ${tipo.toLowerCase()} registrada com sucesso!`, 'success');
        document.getElementById('formMovimentacao').reset();
        this.atualizarSelectProdutos();
        this.atualizarTabelaMovimentacoes();
        this.upadateDashboard();
    }

    atualizarTabelaMovimentacoes() {
        const data = document.getElementById('filtroData').value;
        const tipo = document.getElementById('filtroMovTipo').value;
        const tbody = document.getElementById('tabelaMovimentacoes');

        let movimentacoes = this.storage.getMovimentacoes();

        // Filtros
        movimentacoes = movimentacoes.filter(mov => {
            const dataMovimento = new Date(mov.data).toISOString().split('T')[0];
            const dataCerca = !data || dataMovimento === data;
            const tipoCerca = !tipo || mov.tipo === tipo;
            return dataCerca && tipoCerca;
        });

        movimentacoes = movimentacoes.reverse();

        if (movimentacoes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma movimentação encontrada</td></tr>';
            return;
        }

        tbody.innerHTML = movimentacoes.map(mov => {
            const produto = this.storage.getProduto(mov.produtoId);
            const nomeProduto = produto ? produto.nome : 'Produto desconhecido';
            const data = new Date(mov.data).toLocaleDateString('pt-BR');
            return `
                <tr>
                    <td>${nomeProduto}</td>
                    <td>${mov.tipo}</td>
                    <td>${mov.quantidade}</td>
                    <td>${data}</td>
                    <td>${mov.observacao || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    // Balanço
    iniciarContagem() {
        const produtos = this.storage.getProdutos();
        if (produtos.length === 0) {
            this.mostrarToast('Nenhum produto cadastrado', 'warning');
            return;
        }

        this.contagemEmAndamento = true;
        this.contagemDados = {};
        this.atualizarTabelaBalanco();

        document.getElementById('btnIniciarContagem').style.display = 'none';
        document.getElementById('btnConcluirContagem').style.display = 'inline-block';
        this.mostrarToast('Contagem iniciada! Preencha os campos para contar o estoque', 'info');
    }

    atualizarTabelaBalanco() {
        const produtos = this.storage.getProdutos();
        const tbody = document.getElementById('tabelaBalncoBody');

        if (produtos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum produto cadastrado</td></tr>';
            return;
        }

        tbody.innerHTML = produtos.map(p => {
            const estoquContado = this.contagemDados[p.id] !== undefined ? this.contagemDados[p.id] : '';
            const divergencia = estoquContado !== '' ? Math.abs(p.quantidade - estoquContado) : '';
            
            return `
                <tr>
                    <td>${p.nome}</td>
                    <td>${p.quantidade}</td>
                    <td>
                        <input type="number" 
                               data-produto-id="${p.id}" 
                               class="contagem-input"
                               value="${estoquContado}"
                               ${this.contagemEmAndamento ? '' : 'disabled'}
                               onchange="app.atualizarContagemDados(this)">
                    </td>
                    <td>${divergencia ? `${divergencia} ${estoquContado < p.quantidade ? '-(falta)' : '+(sobra)'}` : '-'}</td>
                </tr>
            `;
        }).join('');
    }

    atualizarContagemDados(input) {
        const produtoId = parseInt(input.dataset.produtoId);
        const valor = input.value ? parseInt(input.value) : undefined;
        
        if (valor !== undefined) {
            this.contagemDados[produtoId] = valor;
        }
        
        this.atualizarTabelaBalanco();
    }

    concluirContagem() {
        const produtos = this.storage.getProdutos();
        let divergencias = [];

        produtos.forEach(p => {
            if (!(p.id in this.contagemDados)) return;

            const estoquContado = this.contagemDados[p.id];
            if (estoquContado !== p.quantidade) {
                const diferenca = estoquContado - p.quantidade;
                divergencias.push({
                    produto: p,
                    diferenca,
                    novo: estoquContado
                });

                // Registrar ajuste de inventário
                this.storage.atualizarProduto(p.id, { quantidade: estoquContado });
                this.storage.adicionarMovimentacao({
                    produtoId: p.id,
                    tipo: 'Ajuste de Inventário',
                    quantidade: Math.abs(diferenca),
                    observacao: `Ajuste de inventário: ${p.quantidade} → ${estoquContado}`
                });
            }
        });

        this.contagemEmAndamento = false;
        document.getElementById('btnIniciarContagem').style.display = 'inline-block';
        document.getElementById('btnConcluirContagem').style.display = 'none';

        // Mostrar resumo
        const resumoDiv = document.getElementById('containerResumoBalanco');
        if (divergencias.length > 0) {
            let resumoHtml = '<h4>Divergências Encontradas:</h4><ul>';
            divergencias.forEach(d => {
                resumoHtml += `<li>${d.produto.nome}: ${d.produto.quantidade} → ${d.novo} (${d.diferenca > 0 ? '+' : ''}${d.diferenca})</li>`;
            });
            resumoHtml += '</ul>';
            document.getElementById('resumoBalanco').innerHTML = resumoHtml;
            resumoDiv.style.display = 'block';
        } else {
            document.getElementById('resumoBalanco').innerHTML = 'Nenhuma divergência encontrada! O estoque está conforme registrado.';
            resumoDiv.style.display = 'block';
        }

        this.mostrarToast(`Contagem concluída! ${divergencias.length} divergência(s) encontrada(s)`, divergencias.length > 0 ? 'warning' : 'success');
        this.atualizarTabelaBalanco();
        this.atualizarTabelaMovimentacoes();
        this.upadateDashboard();
    }

    // Lista de Compras
    gerarListaCompras() {
        const produtos = this.storage.getProdutos();
        const tbody = document.getElementById('tabelaListaCompras');

        const produtosParaComprar = produtos.filter(p => parseInt(p.quantidade) <= parseInt(p.minimo));

        if (produtosParaComprar.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty">Todos os produtos estão com estoque adequado!</td></tr>';
            return;
        }

        tbody.innerHTML = produtosParaComprar.map(p => {
            const sugestao = parseInt(p.minimo) * 2 - parseInt(p.quantidade);
            return `
                <tr>
                    <td>${p.nome}</td>
                    <td>${p.quantidade}</td>
                    <td>${p.minimo}</td>
                    <td>${sugestao}</td>
                </tr>
            `;
        }).join('');

        this.mostrarToast(`${produtosParaComprar.length} produto(s) com estoque baixo!`, 'warning');
    }

    exportarLista() {
        const produtos = this.storage.getProdutos();
        const produtosParaComprar = produtos.filter(p => parseInt(p.quantidade) <= parseInt(p.minimo));

        if (produtosParaComprar.length === 0) {
            this.mostrarToast('Nenhum produto com estoque baixo para exportar', 'warning');
            return;
        }

        let conteudo = 'LISTA DE COMPRAS AUTOMÁTICA\n';
        conteudo += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
        conteudo += '='.repeat(60) + '\n\n';

        produtosParaComprar.forEach(p => {
            const sugestao = parseInt(p.minimo) * 2 - parseInt(p.quantidade);
            conteudo += `Produto: ${p.nome}\n`;
            conteudo += `Categoria: ${p.categoria}\n`;
            conteudo += `Estoque Atual: ${p.quantidade}\n`;
            conteudo += `Estoque Mínimo: ${p.minimo}\n`;
            conteudo += `Sugestão de Reposição: ${sugestao}\n`;
            conteudo += '-'.repeat(60) + '\n\n';
        });

        this.baixarArquivo(conteudo, 'lista-compras.txt');
        this.mostrarToast('Lista de compras exportada!', 'success');
    }

    // Backup
    exportarBackup() {
        const dados = this.storage.exportarDados();
        const backup = {
            timestamp: new Date().toISOString(),
            dados: JSON.parse(dados)
        };
        
        const conteudo = JSON.stringify(backup, null, 2);
        this.baixarArquivo(conteudo, 'backup-estoque.txt');
        
        const statusDiv = document.getElementById('statusBackup');
        statusDiv.className = 'success';
        statusDiv.textContent = '✓ Backup exportado com sucesso!';
        this.mostrarToast('Backup salvo com sucesso!', 'success');
    }

    importarBackup(e) {
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        const reader = new FileReader();
        reader.onload = (evento) => {
            try {
                const conteudo = evento.target.result;
                const backup = JSON.parse(conteudo);
                
                if (!backup.dados) {
                    throw new Error('Arquivo de backup inválido');
                }

                if (this.storage.importarDados(JSON.stringify(backup.dados))) {
                    const statusDiv = document.getElementById('statusBackup');
                    statusDiv.className = 'success';
                    statusDiv.textContent = '✓ Backup importado com sucesso! Os dados foram restaurados.';
                    this.mostrarToast('Backup restaurado com sucesso!', 'success');
                    this.upadateDashboard();
                    this.atualizarTabelaProdutos();
                } else {
                    throw new Error('Erro ao processar o backup');
                }
            } catch (erro) {
                const statusDiv = document.getElementById('statusBackup');
                statusDiv.className = 'error';
                statusDiv.textContent = `✗ Erro ao importar backup: ${erro.message}`;
                this.mostrarToast('Erro ao importar backup', 'error');
            }
        };
        reader.readAsText(arquivo);
        
        // Limpar input
        e.target.value = '';
    }

    // Utilitários
    baixarArquivo(conteudo, nomeArquivo) {
        const elemento = document.createElement('a');
        elemento.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(conteudo));
        elemento.setAttribute('download', nomeArquivo);
        elemento.style.display = 'none';
        document.body.appendChild(elemento);
        elemento.click();
        document.body.removeChild(elemento);
    }

    mostrarToast(mensagem, tipo = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = mensagem;
        toast.className = `toast show ${tipo}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Inicializar aplicação
const app = new App();