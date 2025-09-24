import React from 'react';
import {Table, Tag, Typography, Tooltip, Space, Alert} from 'antd';
import {CheckCircleOutlined, ExclamationCircleOutlined, CopyOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';

const {Text, Title} = Typography;

interface TokenSupply {
	Name: string;
	Address: string;
	supply: string;
	error: string;
	updatedAt: string;
}

interface ApiResponse {
	code: number;
	message: string;
	data: {
		list: TokenSupply[];
	};
}

interface Props {
	data: TokenSupply[];
	loading?: boolean;
}

export const TokenSupplyTable: React.FC<Props> = ({data, loading = false}) => {
	const formatSupply = (supply: string): string => {
		const num = parseFloat(supply);
		if (num >= 1000000) {
			return `${(num / 1000000).toFixed(2)}M`;
		} else if (num >= 1000) {
			return `${(num / 1000).toFixed(2)}K`;
		}
		return num.toString();
	};

	const formatAddress = (address: string): JSX.Element | string => {
		if (!address) return '-';
		let link = `https://evm.confluxscan.org/token/${address}`;
		if (address === '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599') {
			// wBTC on ethereum
			link = `https://www.oklink.com/zh-hans/eth/token/${address}`;
		}
		return <a href={link} target={"_blank"}>
			{address.slice(0, 8)}...{address.slice(-6)}
		</a>
	};

	const formatDate = (dateString: string): string => {
		try {
			const date = new Date(dateString);
			return date.toLocaleString();
		} catch (error) {
			return dateString;
		}
	};

	const columns: ColumnsType<TokenSupply> = [
		{
			title: 'Config Name',
			dataIndex: 'Name',
			key: 'name',
			width: 200,
			render: (name: string, record) => (
				<Space direction="vertical" size={2}>
					<Text strong>{name}</Text>
					{record.error && (
						<Text type="danger" style={{fontSize: '12px'}}>
							{record.error}
						</Text>
					)}
				</Space>
			),
		},
		{
			title: 'Token Address',
			dataIndex: 'Address',
			key: 'address',
			width: 150,
			render: (address: string) => (
				<Space>
					<Text copyable={{text: address, icon: <CopyOutlined/>}}
					      style={{fontFamily: 'monospace', cursor: 'pointer'}}>
						{formatAddress(address)}
					</Text>
				</Space>
			),
		},
		{
			title: 'Supply',
			dataIndex: 'supply',
			key: 'supply',
			width: 140,
			align: 'right' as const,
			render: (supply: string, record) => {

				return (
					<Text
						strong
						style={{
							fontFamily: 'monospace',
							fontSize: '14px'
						}}
					>
						{formatSupply(supply)}
					</Text>
				);
			},
		},
		{
			title: 'Last Updated',
			dataIndex: 'updatedAt',
			key: 'updatedAt',
			width: 180,
			render: (updatedAt: string) => (
				<Tooltip title={updatedAt}>
					<Text type="secondary" style={{fontSize: '12px'}}>
						{formatDate(updatedAt)}
					</Text>
				</Tooltip>
			),
		},
	];

	return (
		<div>
			<Table
				columns={columns}
				dataSource={data.map((item, index) => ({...item, key: index}))}
				loading={loading}
				scroll={{x: 1000}}
				pagination={{
					pageSize: 15,
					showSizeChanger: false,
					showQuickJumper: false,
					showTotal: (total, range) =>
						`${range[0]}-${range[1]} of ${total} tokens`,
				}}
				size="middle"
				bordered
			/>
		</div>
	);
};
