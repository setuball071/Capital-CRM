--
-- PostgreSQL database dump
--

\restrict MvDrcpsmmW9URZC850JzxMeWZ1FkwPNYIW4d18ySsUSiNuMKgX63pSTuhvvNmvN

-- Dumped from database version 16.11 (b740647)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: abordagens_geradas; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.abordagens_geradas (
    id integer NOT NULL,
    user_id integer NOT NULL,
    canal character varying(20) NOT NULL,
    tipo_cliente character varying(50) NOT NULL,
    produto_foco character varying(50) NOT NULL,
    contexto text,
    abertura_resumida text,
    objetivo_abordagem text,
    perguntas_consultivas jsonb DEFAULT '[]'::jsonb,
    exploracao_dor text,
    proposta_valor text,
    gatilhos_usados jsonb DEFAULT '[]'::jsonb,
    script_ligacao text,
    script_whatsapp text,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.abordagens_geradas OWNER TO neondb_owner;

--
-- Name: abordagens_geradas_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.abordagens_geradas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.abordagens_geradas_id_seq OWNER TO neondb_owner;

--
-- Name: abordagens_geradas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.abordagens_geradas_id_seq OWNED BY public.abordagens_geradas.id;


--
-- Name: agreements; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.agreements (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.agreements OWNER TO neondb_owner;

--
-- Name: agreements_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.agreements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agreements_id_seq OWNER TO neondb_owner;

--
-- Name: agreements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.agreements_id_seq OWNED BY public.agreements.id;


--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.ai_prompts (
    id integer NOT NULL,
    type character varying(50) NOT NULL,
    scope character varying(20) NOT NULL,
    team_id integer,
    prompt_text text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_by_user_id integer,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_prompts OWNER TO neondb_owner;

--
-- Name: ai_prompts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.ai_prompts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_prompts_id_seq OWNER TO neondb_owner;

--
-- Name: ai_prompts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.ai_prompts_id_seq OWNED BY public.ai_prompts.id;


--
-- Name: banks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.banks (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    ajuste_saldo_percentual numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.banks OWNER TO neondb_owner;

--
-- Name: banks_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.banks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.banks_id_seq OWNER TO neondb_owner;

--
-- Name: banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.banks_id_seq OWNED BY public.banks.id;


--
-- Name: bases_importadas; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.bases_importadas (
    id integer NOT NULL,
    nome character varying(255),
    base_tag character varying(100) NOT NULL,
    convenio character varying(100),
    competencia timestamp without time zone,
    total_linhas integer DEFAULT 0,
    status character varying(20) DEFAULT 'processando'::character varying NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bases_importadas OWNER TO neondb_owner;

--
-- Name: bases_importadas_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.bases_importadas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bases_importadas_id_seq OWNER TO neondb_owner;

--
-- Name: bases_importadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.bases_importadas_id_seq OWNED BY public.bases_importadas.id;


--
-- Name: client_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_contacts (
    id integer NOT NULL,
    client_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    valor character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_contacts OWNER TO neondb_owner;

--
-- Name: client_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.client_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_contacts_id_seq OWNER TO neondb_owner;

--
-- Name: client_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.client_contacts_id_seq OWNED BY public.client_contacts.id;


--
-- Name: client_snapshots; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_snapshots (
    id integer NOT NULL,
    client_id integer NOT NULL,
    reference_date timestamp without time zone NOT NULL,
    fonte character varying(100) NOT NULL,
    situacao_funcional character varying(100),
    margem_emprestimo numeric(12,2),
    margem_cartao numeric(12,2),
    margem_5 numeric(12,2),
    salario_bruto numeric(12,2),
    salario_liquido numeric(12,2),
    dados_extras jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_snapshots OWNER TO neondb_owner;

--
-- Name: client_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.client_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_snapshots_id_seq OWNER TO neondb_owner;

--
-- Name: client_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.client_snapshots_id_seq OWNED BY public.client_snapshots.id;


--
-- Name: clientes_contratos; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.clientes_contratos (
    id integer NOT NULL,
    pessoa_id integer NOT NULL,
    tipo_contrato character varying(50),
    banco character varying(100),
    valor_parcela numeric(12,2),
    competencia timestamp without time zone,
    base_tag character varying(100),
    dados_brutos jsonb,
    saldo_devedor numeric(12,2),
    parcelas_restantes integer,
    numero_contrato character varying(100),
    parcelas_pagas integer,
    prazo_total integer,
    status character varying(20) DEFAULT 'ATIVO'::character varying NOT NULL,
    started_at timestamp without time zone,
    ended_at timestamp without time zone
);


ALTER TABLE public.clientes_contratos OWNER TO neondb_owner;

--
-- Name: clientes_contratos_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.clientes_contratos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_contratos_id_seq OWNER TO neondb_owner;

--
-- Name: clientes_contratos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.clientes_contratos_id_seq OWNED BY public.clientes_contratos.id;


--
-- Name: clientes_folha_mes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.clientes_folha_mes (
    id integer NOT NULL,
    pessoa_id integer NOT NULL,
    competencia timestamp without time zone NOT NULL,
    margem_bruta_30 numeric(12,2),
    margem_utilizada_30 numeric(12,2),
    margem_saldo_30 numeric(12,2),
    margem_bruta_35 numeric(12,2),
    margem_utilizada_35 numeric(12,2),
    margem_saldo_35 numeric(12,2),
    margem_bruta_70 numeric(12,2),
    margem_utilizada_70 numeric(12,2),
    margem_saldo_70 numeric(12,2),
    creditos numeric(12,2),
    debitos numeric(12,2),
    liquido numeric(12,2),
    sit_func_no_mes character varying(100),
    base_tag character varying(100),
    extras_folha jsonb,
    margem_cartao_credito_saldo numeric(12,2),
    margem_cartao_beneficio_saldo numeric(12,2),
    salario_bruto numeric(12,2),
    descontos_brutos numeric(12,2),
    salario_liquido numeric(12,2)
);


ALTER TABLE public.clientes_folha_mes OWNER TO neondb_owner;

--
-- Name: clientes_folha_mes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.clientes_folha_mes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_folha_mes_id_seq OWNER TO neondb_owner;

--
-- Name: clientes_folha_mes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.clientes_folha_mes_id_seq OWNED BY public.clientes_folha_mes.id;


--
-- Name: clientes_pessoa; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.clientes_pessoa (
    id integer NOT NULL,
    cpf character varying(14),
    matricula character varying(50) NOT NULL,
    nome character varying(255),
    orgaodesc character varying(255),
    orgaocod character varying(50),
    undpagadoradesc character varying(255),
    undpagadoracod character varying(50),
    natureza character varying(100),
    sit_func character varying(100),
    convenio character varying(100),
    uf character varying(100),
    municipio character varying(150),
    telefones_base jsonb,
    base_tag_ultima character varying(100),
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    extras_pessoa jsonb,
    banco_codigo character varying(20),
    agencia character varying(20),
    conta character varying(30),
    upag character varying(100),
    data_nascimento timestamp without time zone,
    margem_emprestimo_atual numeric(12,2),
    margem_cartao_atual numeric(12,2),
    margem_5_atual numeric(12,2),
    situacao_funcional_atual character varying(100),
    salario_bruto_atual numeric(12,2),
    salario_liquido_atual numeric(12,2),
    last_source character varying(100)
);


ALTER TABLE public.clientes_pessoa OWNER TO neondb_owner;

--
-- Name: clientes_pessoa_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.clientes_pessoa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clientes_pessoa_id_seq OWNER TO neondb_owner;

--
-- Name: clientes_pessoa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.clientes_pessoa_id_seq OWNED BY public.clientes_pessoa.id;


--
-- Name: coefficient_tables; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.coefficient_tables (
    id integer NOT NULL,
    bank character varying(255) NOT NULL,
    term_months integer NOT NULL,
    table_name character varying(255) NOT NULL,
    coefficient numeric(12,10) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    agreement_id integer NOT NULL,
    safety_margin numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    operation_type character varying(50) DEFAULT 'credit_card'::character varying NOT NULL,
    margin_type character varying(20) DEFAULT 'percentual'::character varying NOT NULL
);


ALTER TABLE public.coefficient_tables OWNER TO neondb_owner;

--
-- Name: coefficient_tables_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.coefficient_tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coefficient_tables_id_seq OWNER TO neondb_owner;

--
-- Name: coefficient_tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.coefficient_tables_id_seq OWNED BY public.coefficient_tables.id;


--
-- Name: feedbacks_ia_historico; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.feedbacks_ia_historico (
    id integer NOT NULL,
    user_id integer NOT NULL,
    gerado_por_id integer,
    nota_geral numeric(4,2) NOT NULL,
    resumo text NOT NULL,
    pontos_fortes jsonb DEFAULT '[]'::jsonb NOT NULL,
    areas_desenvolvimento jsonb DEFAULT '[]'::jsonb NOT NULL,
    recomendacoes jsonb DEFAULT '[]'::jsonb NOT NULL,
    proximos_passos jsonb DEFAULT '[]'::jsonb NOT NULL,
    metricas jsonb,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.feedbacks_ia_historico OWNER TO neondb_owner;

--
-- Name: feedbacks_ia_historico_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.feedbacks_ia_historico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feedbacks_ia_historico_id_seq OWNER TO neondb_owner;

--
-- Name: feedbacks_ia_historico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.feedbacks_ia_historico_id_seq OWNED BY public.feedbacks_ia_historico.id;


--
-- Name: lead_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lead_contacts (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    type character varying(20) DEFAULT 'phone'::character varying NOT NULL,
    label character varying(100),
    value character varying(255) NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lead_contacts OWNER TO neondb_owner;

--
-- Name: lead_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.lead_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_contacts_id_seq OWNER TO neondb_owner;

--
-- Name: lead_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.lead_contacts_id_seq OWNED BY public.lead_contacts.id;


--
-- Name: lead_interactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lead_interactions (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    user_id integer NOT NULL,
    tipo_contato character varying(30) NOT NULL,
    lead_marker character varying(30) NOT NULL,
    motivo character varying(255),
    observacao text,
    retorno_em timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    contact_id integer,
    margem_valor numeric(12,2),
    proposta_valor_estimado numeric(12,2)
);


ALTER TABLE public.lead_interactions OWNER TO neondb_owner;

--
-- Name: lead_interactions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.lead_interactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_interactions_id_seq OWNER TO neondb_owner;

--
-- Name: lead_interactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.lead_interactions_id_seq OWNED BY public.lead_interactions.id;


--
-- Name: lead_schedules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lead_schedules (
    id integer NOT NULL,
    assignment_id integer NOT NULL,
    user_id integer NOT NULL,
    data_hora timestamp without time zone NOT NULL,
    observacao text,
    status character varying(30) DEFAULT 'pendente'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lead_schedules OWNER TO neondb_owner;

--
-- Name: lead_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.lead_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_schedules_id_seq OWNER TO neondb_owner;

--
-- Name: lead_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.lead_schedules_id_seq OWNED BY public.lead_schedules.id;


--
-- Name: pacotes_preco; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pacotes_preco (
    id integer NOT NULL,
    quantidade_maxima integer NOT NULL,
    nome_pacote character varying(100) NOT NULL,
    preco numeric(10,2) NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pacotes_preco OWNER TO neondb_owner;

--
-- Name: pacotes_preco_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pacotes_preco_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pacotes_preco_id_seq OWNER TO neondb_owner;

--
-- Name: pacotes_preco_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pacotes_preco_id_seq OWNED BY public.pacotes_preco.id;


--
-- Name: pedidos_lista; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pedidos_lista (
    id integer NOT NULL,
    coordenador_id integer,
    filtros_usados jsonb,
    quantidade_registros integer DEFAULT 0,
    tipo character varying(50) DEFAULT 'exportacao_base'::character varying,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    custo_estimado numeric(12,2),
    custo_final numeric(12,2),
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL,
    status_financeiro character varying(20),
    arquivo_path character varying(500),
    arquivo_gerado_em timestamp without time zone,
    nome_pacote character varying(100)
);


ALTER TABLE public.pedidos_lista OWNER TO neondb_owner;

--
-- Name: pedidos_lista_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pedidos_lista_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedidos_lista_id_seq OWNER TO neondb_owner;

--
-- Name: pedidos_lista_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pedidos_lista_id_seq OWNED BY public.pedidos_lista.id;


--
-- Name: pricing_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pricing_settings (
    id integer NOT NULL,
    preco_ancora_min numeric(12,4) DEFAULT 1.0000 NOT NULL,
    qtd_ancora_min integer DEFAULT 1 NOT NULL,
    preco_ancora_max numeric(12,2) DEFAULT 2000.00 NOT NULL,
    qtd_ancora_max integer DEFAULT 1000000 NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pricing_settings OWNER TO neondb_owner;

--
-- Name: pricing_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pricing_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pricing_settings_id_seq OWNER TO neondb_owner;

--
-- Name: pricing_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pricing_settings_id_seq OWNED BY public.pricing_settings.id;


--
-- Name: progresso_licoes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.progresso_licoes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    licao_id character varying(10) NOT NULL,
    nivel_id integer NOT NULL,
    concluida boolean DEFAULT false NOT NULL,
    respostas_atividade text,
    concluida_em timestamp without time zone
);


ALTER TABLE public.progresso_licoes OWNER TO neondb_owner;

--
-- Name: progresso_licoes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.progresso_licoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.progresso_licoes_id_seq OWNER TO neondb_owner;

--
-- Name: progresso_licoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.progresso_licoes_id_seq OWNED BY public.progresso_licoes.id;


--
-- Name: quiz_tentativas; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quiz_tentativas (
    id integer NOT NULL,
    user_id integer NOT NULL,
    respostas jsonb NOT NULL,
    acertos integer NOT NULL,
    total integer NOT NULL,
    aprovado boolean NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quiz_tentativas OWNER TO neondb_owner;

--
-- Name: quiz_tentativas_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.quiz_tentativas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quiz_tentativas_id_seq OWNER TO neondb_owner;

--
-- Name: quiz_tentativas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.quiz_tentativas_id_seq OWNED BY public.quiz_tentativas.id;


--
-- Name: roleplay_avaliacoes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.roleplay_avaliacoes (
    id integer NOT NULL,
    sessao_id integer NOT NULL,
    user_id integer NOT NULL,
    fala_corretor text NOT NULL,
    nota_global numeric(4,2) NOT NULL,
    nota_humanizacao numeric(4,2),
    nota_consultivo numeric(4,2),
    nota_clareza numeric(4,2),
    nota_venda numeric(4,2),
    comentario_geral text,
    pontos_fortes jsonb DEFAULT '[]'::jsonb,
    pontos_melhorar jsonb DEFAULT '[]'::jsonb,
    nivel_sugerido integer,
    aprovado_proximo_nivel boolean DEFAULT false,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roleplay_avaliacoes OWNER TO neondb_owner;

--
-- Name: roleplay_avaliacoes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.roleplay_avaliacoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roleplay_avaliacoes_id_seq OWNER TO neondb_owner;

--
-- Name: roleplay_avaliacoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.roleplay_avaliacoes_id_seq OWNED BY public.roleplay_avaliacoes.id;


--
-- Name: roleplay_sessoes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.roleplay_sessoes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    nivel_treinado integer NOT NULL,
    status character varying(20) DEFAULT 'ativa'::character varying NOT NULL,
    historico_conversa jsonb DEFAULT '[]'::jsonb NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    finalizado_em timestamp without time zone,
    cenario text,
    total_mensagens integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.roleplay_sessoes OWNER TO neondb_owner;

--
-- Name: roleplay_sessoes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.roleplay_sessoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roleplay_sessoes_id_seq OWNER TO neondb_owner;

--
-- Name: roleplay_sessoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.roleplay_sessoes_id_seq OWNED BY public.roleplay_sessoes.id;


--
-- Name: roteiros_bancarios; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.roteiros_bancarios (
    id integer NOT NULL,
    banco character varying(100) NOT NULL,
    convenio character varying(150) NOT NULL,
    segmento character varying(50),
    tipo_operacao character varying(50) NOT NULL,
    dados jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roteiros_bancarios OWNER TO neondb_owner;

--
-- Name: roteiros_bancarios_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.roteiros_bancarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roteiros_bancarios_id_seq OWNER TO neondb_owner;

--
-- Name: roteiros_bancarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.roteiros_bancarios_id_seq OWNED BY public.roteiros_bancarios.id;


--
-- Name: sales_campaigns; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_campaigns (
    id integer NOT NULL,
    nome character varying(255) NOT NULL,
    descricao text,
    origem character varying(100),
    convenio character varying(100),
    uf character varying(10),
    status character varying(20) DEFAULT 'ativa'::character varying NOT NULL,
    total_leads integer DEFAULT 0 NOT NULL,
    leads_disponiveis integer DEFAULT 0 NOT NULL,
    leads_distribuidos integer DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    filtros_json jsonb
);


ALTER TABLE public.sales_campaigns OWNER TO neondb_owner;

--
-- Name: sales_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sales_campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_campaigns_id_seq OWNER TO neondb_owner;

--
-- Name: sales_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sales_campaigns_id_seq OWNED BY public.sales_campaigns.id;


--
-- Name: sales_lead_assignments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_lead_assignments (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    user_id integer NOT NULL,
    campaign_id integer NOT NULL,
    status character varying(30) DEFAULT 'novo'::character varying NOT NULL,
    ordem_fila integer DEFAULT 0 NOT NULL,
    data_primeiro_atendimento timestamp without time zone,
    data_ultimo_atendimento timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sales_lead_assignments OWNER TO neondb_owner;

--
-- Name: sales_lead_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sales_lead_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_lead_assignments_id_seq OWNER TO neondb_owner;

--
-- Name: sales_lead_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sales_lead_assignments_id_seq OWNED BY public.sales_lead_assignments.id;


--
-- Name: sales_lead_events; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_lead_events (
    id integer NOT NULL,
    assignment_id integer NOT NULL,
    user_id integer,
    tipo character varying(30) NOT NULL,
    resultado character varying(50),
    observacao text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sales_lead_events OWNER TO neondb_owner;

--
-- Name: sales_lead_events_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sales_lead_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_lead_events_id_seq OWNER TO neondb_owner;

--
-- Name: sales_lead_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sales_lead_events_id_seq OWNED BY public.sales_lead_events.id;


--
-- Name: sales_leads; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_leads (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    cpf character varying(14),
    nome character varying(255) NOT NULL,
    telefone_1 character varying(20),
    telefone_2 character varying(20),
    telefone_3 character varying(20),
    email character varying(255),
    cidade character varying(150),
    uf character varying(10),
    observacoes text,
    base_cliente_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    lead_marker character varying(30) DEFAULT 'NOVO'::character varying NOT NULL,
    retorno_em timestamp without time zone,
    motivo character varying(255),
    ultimo_contato_em timestamp without time zone,
    ultimo_tipo_contato character varying(30),
    current_margin numeric(12,2),
    current_proposal numeric(12,2)
);


ALTER TABLE public.sales_leads OWNER TO neondb_owner;

--
-- Name: sales_leads_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sales_leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_leads_id_seq OWNER TO neondb_owner;

--
-- Name: sales_leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sales_leads_id_seq OWNED BY public.sales_leads.id;


--
-- Name: simulations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.simulations (
    id integer NOT NULL,
    user_id integer,
    client_name character varying(255) NOT NULL,
    agreement_id integer,
    agreement_name character varying(255),
    bank character varying(255) NOT NULL,
    term_months integer NOT NULL,
    table_name character varying(255) NOT NULL,
    coefficient numeric(12,10) NOT NULL,
    monthly_payment numeric(12,2) NOT NULL,
    outstanding_balance numeric(12,2) NOT NULL,
    total_contract_value numeric(12,2) NOT NULL,
    client_refund numeric(12,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    operation_type character varying(50) NOT NULL
);


ALTER TABLE public.simulations OWNER TO neondb_owner;

--
-- Name: simulations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.simulations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.simulations_id_seq OWNER TO neondb_owner;

--
-- Name: simulations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.simulations_id_seq OWNED BY public.simulations.id;


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.team_members (
    id integer NOT NULL,
    team_id integer NOT NULL,
    user_id integer NOT NULL,
    role_in_team character varying(20) DEFAULT 'seller'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.team_members OWNER TO neondb_owner;

--
-- Name: team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.team_members_id_seq OWNER TO neondb_owner;

--
-- Name: team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    manager_user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.teams OWNER TO neondb_owner;

--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_id_seq OWNER TO neondb_owner;

--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    module character varying(100) NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delegate boolean DEFAULT false NOT NULL
);


ALTER TABLE public.user_permissions OWNER TO neondb_owner;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_permissions_id_seq OWNER TO neondb_owner;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: user_pipeline_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_pipeline_settings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    column_order jsonb,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_pipeline_settings OWNER TO neondb_owner;

--
-- Name: user_pipeline_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_pipeline_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_pipeline_settings_id_seq OWNER TO neondb_owner;

--
-- Name: user_pipeline_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_pipeline_settings_id_seq OWNED BY public.user_pipeline_settings.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) DEFAULT 'vendedor'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    manager_id integer
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vendedores_academia; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendedores_academia (
    id integer NOT NULL,
    user_id integer NOT NULL,
    nivel_atual integer DEFAULT 1 NOT NULL,
    quiz_aprovado boolean DEFAULT false NOT NULL,
    quiz_aprovado_em timestamp without time zone,
    total_simulacoes integer DEFAULT 0 NOT NULL,
    nota_media_global numeric(4,2),
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendedores_academia OWNER TO neondb_owner;

--
-- Name: vendedores_academia_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.vendedores_academia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendedores_academia_id_seq OWNER TO neondb_owner;

--
-- Name: vendedores_academia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.vendedores_academia_id_seq OWNED BY public.vendedores_academia.id;


--
-- Name: abordagens_geradas id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.abordagens_geradas ALTER COLUMN id SET DEFAULT nextval('public.abordagens_geradas_id_seq'::regclass);


--
-- Name: agreements id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.agreements ALTER COLUMN id SET DEFAULT nextval('public.agreements_id_seq'::regclass);


--
-- Name: ai_prompts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ai_prompts ALTER COLUMN id SET DEFAULT nextval('public.ai_prompts_id_seq'::regclass);


--
-- Name: banks id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.banks ALTER COLUMN id SET DEFAULT nextval('public.banks_id_seq'::regclass);


--
-- Name: bases_importadas id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bases_importadas ALTER COLUMN id SET DEFAULT nextval('public.bases_importadas_id_seq'::regclass);


--
-- Name: client_contacts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_contacts ALTER COLUMN id SET DEFAULT nextval('public.client_contacts_id_seq'::regclass);


--
-- Name: client_snapshots id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_snapshots ALTER COLUMN id SET DEFAULT nextval('public.client_snapshots_id_seq'::regclass);


--
-- Name: clientes_contratos id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_contratos ALTER COLUMN id SET DEFAULT nextval('public.clientes_contratos_id_seq'::regclass);


--
-- Name: clientes_folha_mes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_folha_mes ALTER COLUMN id SET DEFAULT nextval('public.clientes_folha_mes_id_seq'::regclass);


--
-- Name: clientes_pessoa id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_pessoa ALTER COLUMN id SET DEFAULT nextval('public.clientes_pessoa_id_seq'::regclass);


--
-- Name: coefficient_tables id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.coefficient_tables ALTER COLUMN id SET DEFAULT nextval('public.coefficient_tables_id_seq'::regclass);


--
-- Name: feedbacks_ia_historico id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.feedbacks_ia_historico ALTER COLUMN id SET DEFAULT nextval('public.feedbacks_ia_historico_id_seq'::regclass);


--
-- Name: lead_contacts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_contacts ALTER COLUMN id SET DEFAULT nextval('public.lead_contacts_id_seq'::regclass);


--
-- Name: lead_interactions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_interactions ALTER COLUMN id SET DEFAULT nextval('public.lead_interactions_id_seq'::regclass);


--
-- Name: lead_schedules id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_schedules ALTER COLUMN id SET DEFAULT nextval('public.lead_schedules_id_seq'::regclass);


--
-- Name: pacotes_preco id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pacotes_preco ALTER COLUMN id SET DEFAULT nextval('public.pacotes_preco_id_seq'::regclass);


--
-- Name: pedidos_lista id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos_lista ALTER COLUMN id SET DEFAULT nextval('public.pedidos_lista_id_seq'::regclass);


--
-- Name: pricing_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pricing_settings ALTER COLUMN id SET DEFAULT nextval('public.pricing_settings_id_seq'::regclass);


--
-- Name: progresso_licoes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.progresso_licoes ALTER COLUMN id SET DEFAULT nextval('public.progresso_licoes_id_seq'::regclass);


--
-- Name: quiz_tentativas id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quiz_tentativas ALTER COLUMN id SET DEFAULT nextval('public.quiz_tentativas_id_seq'::regclass);


--
-- Name: roleplay_avaliacoes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roleplay_avaliacoes ALTER COLUMN id SET DEFAULT nextval('public.roleplay_avaliacoes_id_seq'::regclass);


--
-- Name: roleplay_sessoes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roleplay_sessoes ALTER COLUMN id SET DEFAULT nextval('public.roleplay_sessoes_id_seq'::regclass);


--
-- Name: roteiros_bancarios id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roteiros_bancarios ALTER COLUMN id SET DEFAULT nextval('public.roteiros_bancarios_id_seq'::regclass);


--
-- Name: sales_campaigns id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_campaigns ALTER COLUMN id SET DEFAULT nextval('public.sales_campaigns_id_seq'::regclass);


--
-- Name: sales_lead_assignments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_assignments ALTER COLUMN id SET DEFAULT nextval('public.sales_lead_assignments_id_seq'::regclass);


--
-- Name: sales_lead_events id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_events ALTER COLUMN id SET DEFAULT nextval('public.sales_lead_events_id_seq'::regclass);


--
-- Name: sales_leads id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_leads ALTER COLUMN id SET DEFAULT nextval('public.sales_leads_id_seq'::regclass);


--
-- Name: simulations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.simulations ALTER COLUMN id SET DEFAULT nextval('public.simulations_id_seq'::regclass);


--
-- Name: team_members id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: user_pipeline_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_pipeline_settings ALTER COLUMN id SET DEFAULT nextval('public.user_pipeline_settings_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vendedores_academia id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendedores_academia ALTER COLUMN id SET DEFAULT nextval('public.vendedores_academia_id_seq'::regclass);


--
-- Name: abordagens_geradas abordagens_geradas_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.abordagens_geradas
    ADD CONSTRAINT abordagens_geradas_pkey PRIMARY KEY (id);


--
-- Name: agreements agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_pkey PRIMARY KEY (id);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


--
-- Name: banks banks_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_name_unique UNIQUE (name);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: bases_importadas bases_importadas_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bases_importadas
    ADD CONSTRAINT bases_importadas_pkey PRIMARY KEY (id);


--
-- Name: client_contacts client_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);


--
-- Name: client_snapshots client_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_snapshots
    ADD CONSTRAINT client_snapshots_pkey PRIMARY KEY (id);


--
-- Name: clientes_contratos clientes_contratos_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_contratos
    ADD CONSTRAINT clientes_contratos_pkey PRIMARY KEY (id);


--
-- Name: clientes_folha_mes clientes_folha_mes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_folha_mes
    ADD CONSTRAINT clientes_folha_mes_pkey PRIMARY KEY (id);


--
-- Name: clientes_pessoa clientes_pessoa_cpf_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_pessoa
    ADD CONSTRAINT clientes_pessoa_cpf_unique UNIQUE (cpf);


--
-- Name: clientes_pessoa clientes_pessoa_matricula_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_pessoa
    ADD CONSTRAINT clientes_pessoa_matricula_unique UNIQUE (matricula);


--
-- Name: clientes_pessoa clientes_pessoa_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_pessoa
    ADD CONSTRAINT clientes_pessoa_pkey PRIMARY KEY (id);


--
-- Name: coefficient_tables coefficient_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.coefficient_tables
    ADD CONSTRAINT coefficient_tables_pkey PRIMARY KEY (id);


--
-- Name: feedbacks_ia_historico feedbacks_ia_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.feedbacks_ia_historico
    ADD CONSTRAINT feedbacks_ia_historico_pkey PRIMARY KEY (id);


--
-- Name: lead_contacts lead_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_contacts
    ADD CONSTRAINT lead_contacts_pkey PRIMARY KEY (id);


--
-- Name: lead_interactions lead_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_interactions
    ADD CONSTRAINT lead_interactions_pkey PRIMARY KEY (id);


--
-- Name: lead_schedules lead_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_schedules
    ADD CONSTRAINT lead_schedules_pkey PRIMARY KEY (id);


--
-- Name: pacotes_preco pacotes_preco_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pacotes_preco
    ADD CONSTRAINT pacotes_preco_pkey PRIMARY KEY (id);


--
-- Name: pedidos_lista pedidos_lista_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos_lista
    ADD CONSTRAINT pedidos_lista_pkey PRIMARY KEY (id);


--
-- Name: pricing_settings pricing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pricing_settings
    ADD CONSTRAINT pricing_settings_pkey PRIMARY KEY (id);


--
-- Name: progresso_licoes progresso_licoes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.progresso_licoes
    ADD CONSTRAINT progresso_licoes_pkey PRIMARY KEY (id);


--
-- Name: quiz_tentativas quiz_tentativas_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quiz_tentativas
    ADD CONSTRAINT quiz_tentativas_pkey PRIMARY KEY (id);


--
-- Name: roleplay_avaliacoes roleplay_avaliacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roleplay_avaliacoes
    ADD CONSTRAINT roleplay_avaliacoes_pkey PRIMARY KEY (id);


--
-- Name: roleplay_sessoes roleplay_sessoes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roleplay_sessoes
    ADD CONSTRAINT roleplay_sessoes_pkey PRIMARY KEY (id);


--
-- Name: roteiros_bancarios roteiros_bancarios_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roteiros_bancarios
    ADD CONSTRAINT roteiros_bancarios_pkey PRIMARY KEY (id);


--
-- Name: sales_campaigns sales_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_campaigns
    ADD CONSTRAINT sales_campaigns_pkey PRIMARY KEY (id);


--
-- Name: sales_lead_assignments sales_lead_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_assignments
    ADD CONSTRAINT sales_lead_assignments_pkey PRIMARY KEY (id);


--
-- Name: sales_lead_events sales_lead_events_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_events
    ADD CONSTRAINT sales_lead_events_pkey PRIMARY KEY (id);


--
-- Name: sales_leads sales_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_leads
    ADD CONSTRAINT sales_leads_pkey PRIMARY KEY (id);


--
-- Name: simulations simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_pipeline_settings user_pipeline_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_pipeline_settings
    ADD CONSTRAINT user_pipeline_settings_pkey PRIMARY KEY (id);


--
-- Name: user_pipeline_settings user_pipeline_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_pipeline_settings
    ADD CONSTRAINT user_pipeline_settings_user_id_unique UNIQUE (user_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendedores_academia vendedores_academia_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendedores_academia
    ADD CONSTRAINT vendedores_academia_pkey PRIMARY KEY (id);


--
-- Name: vendedores_academia vendedores_academia_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendedores_academia
    ADD CONSTRAINT vendedores_academia_user_id_unique UNIQUE (user_id);


--
-- Name: abordagens_geradas abordagens_geradas_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.abordagens_geradas
    ADD CONSTRAINT abordagens_geradas_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_prompts ai_prompts_team_id_teams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: ai_prompts ai_prompts_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: client_contacts client_contacts_client_id_clientes_pessoa_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_client_id_clientes_pessoa_id_fk FOREIGN KEY (client_id) REFERENCES public.clientes_pessoa(id) ON DELETE CASCADE;


--
-- Name: client_snapshots client_snapshots_client_id_clientes_pessoa_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_snapshots
    ADD CONSTRAINT client_snapshots_client_id_clientes_pessoa_id_fk FOREIGN KEY (client_id) REFERENCES public.clientes_pessoa(id) ON DELETE CASCADE;


--
-- Name: clientes_contratos clientes_contratos_pessoa_id_clientes_pessoa_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_contratos
    ADD CONSTRAINT clientes_contratos_pessoa_id_clientes_pessoa_id_fk FOREIGN KEY (pessoa_id) REFERENCES public.clientes_pessoa(id) ON DELETE CASCADE;


--
-- Name: clientes_folha_mes clientes_folha_mes_pessoa_id_clientes_pessoa_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clientes_folha_mes
    ADD CONSTRAINT clientes_folha_mes_pessoa_id_clientes_pessoa_id_fk FOREIGN KEY (pessoa_id) REFERENCES public.clientes_pessoa(id) ON DELETE CASCADE;


--
-- Name: coefficient_tables coefficient_tables_agreement_id_agreements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.coefficient_tables
    ADD CONSTRAINT coefficient_tables_agreement_id_agreements_id_fk FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE CASCADE;


--
-- Name: feedbacks_ia_historico feedbacks_ia_historico_gerado_por_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.feedbacks_ia_historico
    ADD CONSTRAINT feedbacks_ia_historico_gerado_por_id_users_id_fk FOREIGN KEY (gerado_por_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: feedbacks_ia_historico feedbacks_ia_historico_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.feedbacks_ia_historico
    ADD CONSTRAINT feedbacks_ia_historico_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lead_contacts lead_contacts_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_contacts
    ADD CONSTRAINT lead_contacts_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_contacts lead_contacts_lead_id_sales_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_contacts
    ADD CONSTRAINT lead_contacts_lead_id_sales_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.sales_leads(id) ON DELETE CASCADE;


--
-- Name: lead_interactions lead_interactions_contact_id_lead_contacts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_interactions
    ADD CONSTRAINT lead_interactions_contact_id_lead_contacts_id_fk FOREIGN KEY (contact_id) REFERENCES public.lead_contacts(id) ON DELETE SET NULL;


--
-- Name: lead_interactions lead_interactions_lead_id_sales_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_interactions
    ADD CONSTRAINT lead_interactions_lead_id_sales_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.sales_leads(id) ON DELETE CASCADE;


--
-- Name: lead_interactions lead_interactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_interactions
    ADD CONSTRAINT lead_interactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_schedules lead_schedules_assignment_id_sales_lead_assignments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_schedules
    ADD CONSTRAINT lead_schedules_assignment_id_sales_lead_assignments_id_fk FOREIGN KEY (assignment_id) REFERENCES public.sales_lead_assignments(id) ON DELETE CASCADE;


--
-- Name: lead_schedules lead_schedules_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_schedules
    ADD CONSTRAINT lead_schedules_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pedidos_lista pedidos_lista_coordenador_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos_lista
    ADD CONSTRAINT pedidos_lista_coordenador_id_users_id_fk FOREIGN KEY (coordenador_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: progresso_licoes progresso_licoes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.progresso_licoes
    ADD CONSTRAINT progresso_licoes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: quiz_tentativas quiz_tentativas_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quiz_tentativas
    ADD CONSTRAINT quiz_tentativas_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: roleplay_avaliacoes roleplay_avaliacoes_sessao_id_roleplay_sessoes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roleplay_avaliacoes
    ADD CONSTRAINT roleplay_avaliacoes_sessao_id_roleplay_sessoes_id_fk FOREIGN KEY (sessao_id) REFERENCES public.roleplay_sessoes(id) ON DELETE CASCADE;


--
-- Name: roleplay_avaliacoes roleplay_avaliacoes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roleplay_avaliacoes
    ADD CONSTRAINT roleplay_avaliacoes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: roleplay_sessoes roleplay_sessoes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roleplay_sessoes
    ADD CONSTRAINT roleplay_sessoes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sales_campaigns sales_campaigns_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_campaigns
    ADD CONSTRAINT sales_campaigns_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales_lead_assignments sales_lead_assignments_campaign_id_sales_campaigns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_assignments
    ADD CONSTRAINT sales_lead_assignments_campaign_id_sales_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES public.sales_campaigns(id) ON DELETE CASCADE;


--
-- Name: sales_lead_assignments sales_lead_assignments_lead_id_sales_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_assignments
    ADD CONSTRAINT sales_lead_assignments_lead_id_sales_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.sales_leads(id) ON DELETE CASCADE;


--
-- Name: sales_lead_assignments sales_lead_assignments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_assignments
    ADD CONSTRAINT sales_lead_assignments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sales_lead_events sales_lead_events_assignment_id_sales_lead_assignments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_events
    ADD CONSTRAINT sales_lead_events_assignment_id_sales_lead_assignments_id_fk FOREIGN KEY (assignment_id) REFERENCES public.sales_lead_assignments(id) ON DELETE CASCADE;


--
-- Name: sales_lead_events sales_lead_events_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_lead_events
    ADD CONSTRAINT sales_lead_events_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales_leads sales_leads_base_cliente_id_clientes_pessoa_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_leads
    ADD CONSTRAINT sales_leads_base_cliente_id_clientes_pessoa_id_fk FOREIGN KEY (base_cliente_id) REFERENCES public.clientes_pessoa(id) ON DELETE SET NULL;


--
-- Name: sales_leads sales_leads_campaign_id_sales_campaigns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_leads
    ADD CONSTRAINT sales_leads_campaign_id_sales_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES public.sales_campaigns(id) ON DELETE CASCADE;


--
-- Name: simulations simulations_agreement_id_agreements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_agreement_id_agreements_id_fk FOREIGN KEY (agreement_id) REFERENCES public.agreements(id);


--
-- Name: simulations simulations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: team_members team_members_team_id_teams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_manager_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_manager_user_id_users_id_fk FOREIGN KEY (manager_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_permissions user_permissions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_pipeline_settings user_pipeline_settings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_pipeline_settings
    ADD CONSTRAINT user_pipeline_settings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vendedores_academia vendedores_academia_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendedores_academia
    ADD CONSTRAINT vendedores_academia_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict MvDrcpsmmW9URZC850JzxMeWZ1FkwPNYIW4d18ySsUSiNuMKgX63pSTuhvvNmvN

