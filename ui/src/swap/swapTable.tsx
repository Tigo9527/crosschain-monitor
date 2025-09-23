import React from 'react';
import { Table, Tag, Typography, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Text, Title } = Typography;

interface Token {
    Id: string;
    Symbol: string;
    Balance: string;
    Price: string;
    MarketCap: number;
}

interface TokenPair {
    Id: string;
    Skip: boolean;
    Ignore: boolean;
    Token0: Token;
    Token1: Token;
    PairLiquidity: number;
    Name: string;
}

interface ApiResponse {
    code: number;
    message: string;
    data: {
        list: TokenPair[];
    };
}

interface Props {
    data: TokenPair[];
    loading?: boolean;
}

const formatNumber = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (num >= 1000000) {
        return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
        return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
};

const formatBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(4);
};

const formatAddress = (address: string): JSX.Element => {
    if (!address) return <>-</>;
    return <a href={`https://evm.confluxscan.org/token/${address}`} target={"_blank"}>
        {address.slice(0, 6)}...{address.slice(-4)}
    </a>
};

export const TokenPairsTable: React.FC<Props> = ({ data, loading = false }) => {
    const columns: ColumnsType<TokenPair> = [
        {
            title: 'Pair Name',
            dataIndex: 'Name',
            key: 'name',
            render: (name: string) => (
                <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>
                    {name}
                </Tag>
            ),
            width: 120,
            fixed: 'left' as const,
        },
        {
            title: 'Pair Liquidity',
            dataIndex: 'PairLiquidity',
            key: 'pairLiquidity',
            render: (liquidity: number) => (
                <Text strong style={{ color: '#52c41a' }}>
                    {formatNumber(liquidity)}
                </Text>
            ),
            sorter: (a, b) => a.PairLiquidity - b.PairLiquidity,
            align: 'right' as const,
            width: 120,
        },
        {
            title: 'Token 0',
            key: 'token0',
            children: [
                {
                    title: 'Symbol',
                    dataIndex: ['Token0', 'Symbol'],
                    key: 'token0Symbol',
                    render: (symbol: string) => (
                        <Tag color="green">{symbol}</Tag>
                    ),
                    width: 80,
                },
                {
                    title: 'Balance',
                    dataIndex: ['Token0', 'Balance'],
                    key: 'token0Balance',
                    render: (balance: string) => formatBalance(balance),
                    align: 'right' as const,
                    width: 100,
                },
                {
                    title: 'ID',
                    dataIndex: ['Token0', 'Id'],
                    key: 'token0Id',
                    render: (id: string) => (
                        <Text copyable={{ text: id }} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                            {formatAddress(id)}
                        </Text>
                    ),
                    width: 120,
                },
                {
                    title: 'Market Cap',
                    dataIndex: ['Token0', 'MarketCap'],
                    key: 'token0MarketCap',
                    render: (marketCap: number) => formatNumber(marketCap),
                    sorter: (a, b) => a.Token0.MarketCap - b.Token0.MarketCap,
                    align: 'right' as const,
                    width: 100,
                },
                {
                    title: 'Price',
                    dataIndex: ['Token0', 'Price'],
                    key: 'token0Price',
                    render: (price: string) => `$${parseFloat(price).toFixed(4)}`,
                    align: 'right' as const,
                    width: 100,
                },
            ],
        },
        {
            title: 'Token 1',
            key: 'token1',
            children: [
                {
                    title: 'Symbol',
                    dataIndex: ['Token1', 'Symbol'],
                    key: 'token1Symbol',
                    render: (symbol: string) => (
                        <Tag color="orange">{symbol}</Tag>
                    ),
                    width: 80,
                },
                {
                    title: 'Balance',
                    dataIndex: ['Token1', 'Balance'],
                    key: 'token1Balance',
                    render: (balance: string) => formatBalance(balance),
                    align: 'right' as const,
                    width: 100,
                },
                {
                    title: 'ID',
                    dataIndex: ['Token1', 'Id'],
                    key: 'token1Id',
                    render: (id: string) => (
                        <Text copyable={{ text: id }} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                            {formatAddress(id)}
                        </Text>
                    ),
                    width: 120,
                },
                {
                    title: 'Market Cap',
                    dataIndex: ['Token1', 'MarketCap'],
                    key: 'token1MarketCap',
                    render: (marketCap: number) => formatNumber(marketCap),
                    sorter: (a, b) => a.Token1.MarketCap - b.Token1.MarketCap,
                    align: 'right' as const,
                    width: 100,
                },
                {
                    title: 'Price',
                    dataIndex: ['Token1', 'Price'],
                    key: 'token1Price',
                    render: (price: string) => `$${parseFloat(price).toFixed(4)}`,
                    align: 'right' as const,
                    width: 100,
                },
            ],
        },
        {
            title: 'Pair ID',
            dataIndex: 'Id',
            key: 'pairId',
            render: (id: string) => (
                <Text copyable={{ text: id }} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {formatAddress(id)}
                </Text>
            ),
            width: 120,
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
                <Space direction="vertical" size="small">
                    {record.Skip && (
                        <Tag color="red" style={{ margin: 0 }}>Skipped</Tag>
                    )}
                    {record.Ignore && (
                        <Tag color="orange" style={{ margin: 0 }}>Ignored</Tag>
                    )}
                    {!record.Skip && !record.Ignore && (
                        <Tag color="green" style={{ margin: 0 }}>Watching</Tag>
                    )}
                </Space>
            ),
            width: 100,
            align: 'center' as const,
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={data.map((item, index) => ({ ...item, key: index }))}
            loading={loading}
            scroll={{ x: 1500 }}
            pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                    `${range[0]}-${range[1]} of ${total} token pairs`,
            }}
            size="middle"
            bordered
        />
    );
};
