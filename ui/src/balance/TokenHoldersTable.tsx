import React from 'react';
import {Table, Tag, Typography, Progress, Tooltip, Space, Row, Col} from 'antd';
import {WarningOutlined, CheckCircleOutlined, InfoCircleOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';

const {Text} = Typography;

interface TokenHolder {
	id: number;
	shortName: string;
	entryName: string;
	contract: string;
	holder: string;
	balance: string;
	minBalance: string;
	updatedAt: string;
}

interface ApiResponse {
	code: number;
	message: string;
	data: {
		list: TokenHolder[];
	};
}

interface Props {
	data: TokenHolder[];
	loading?: boolean;
}

export const TokenHoldersTable: React.FC<Props> = ({data, loading = false}) => {
	const formatBalance = (balance: string): number => {
		return parseFloat(balance);
	};

	const getBalanceStatus = (balance: string, minBalance: string) => {
		const balanceNum = parseFloat(balance);
		const minBalanceNum = parseFloat(minBalance);
		const percentage = (balanceNum / minBalanceNum) * 100;

		if (balanceNum >= minBalanceNum) {
			return {status: 'success', percentage, color: '#52c41a'};
		} else if (balanceNum >= minBalanceNum * 0.5) {
			return {status: 'warning', percentage, color: '#faad14'};
		} else {
			return {status: 'danger', percentage, color: '#ff4d4f'};
		}
	};

	const formatAddress = (address: string): JSX.Element | string => {
		if (!address) return '-';
		const host = address.startsWith("cfx") ? 'www' :  'evm';
		let url = `https://${host}.confluxscan.org/address/${address}`;
			// bCfx on BN chain
		if (address === '0x045c4324039da91c52c55df5d785385aab073dcf') {
			url = `https://www.oklink.com/zh-hans/bsc/token/${address}`;
		}
		return <a href={url} target="_blank">
			{address.slice(0, 8)}...{address.slice(-4)}
		</a>;
	};

	const formatDate = (dateString: string): string => {
		try {
			const date = new Date(dateString);
			return date.toLocaleString();
		} catch (error) {
			return dateString;
		}
	};

	const columns: ColumnsType<TokenHolder> = [
		{
			title: 'Token',
			dataIndex: 'shortName',
			key: 'shortName',
			width: 140,
			render: (shortName: string, record) => (
				<Space direction="vertical" size={2} style={{cursor: 'pointer'}}>
					<Tag color="blue" style={{margin: 0}}>
						{shortName}
					</Tag>
				</Space>
			),
		},
		{
			title: 'Balance Status',
			key: 'balanceStatus',
			width: 220,
			render: (_, record) => {
				const status = getBalanceStatus(record.balance, record.minBalance);

				return (
					<Space direction="vertical" style={{width: '100%'}}>
						<Row gutter={8}>
							<Col span={8}><Text
								strong>Current: {parseFloat(record.balance).toLocaleString()}</Text></Col>
							<Col span={8}><Text type="secondary">Required
								min: {parseFloat(record.minBalance).toLocaleString()}</Text></Col>
							<Col span={8}>
								<div style={{display: 'flex', alignItems: 'center', gap: 4}}>
									{status.status === 'success' ? (
										<>
											<CheckCircleOutlined style={{color: status.color}}/>
											<Text type="success" style={{fontSize: '12px'}}>Sufficient</Text>
										</>
									) : status.status === 'warning' ? (
										<>
											<WarningOutlined style={{color: status.color}}/>
											<Text type="warning" style={{fontSize: '12px'}}>Low</Text>
										</>
									) : (
										<>
											<WarningOutlined style={{color: status.color}}/>
											<Text type="danger" style={{fontSize: '12px'}}>Critical</Text>
										</>
									)}
								</div>
							</Col>
						</Row>
						<Progress
							percent={Math.min(status.percentage, 100)}
							strokeColor={status.color}
							size="small" showInfo={false}
							format={percent => (
								<Text style={{
									fontSize: '12px',
									color: status.color,
									fontWeight: 'bold'
								}}>
									{percent?.toFixed(1)}%
								</Text>
							)}
						/>
						{status.status !== 'success' && (
							<Text type="danger" style={{fontSize: '12px'}}>
								{record.entryName}
							</Text>
						)}
					</Space>
				);
			},
		},
		{
			title: 'Contract Address',
			dataIndex: 'contract',
			key: 'contract',
			width: 50,
			render: (contract: string) => (
				<Text copyable={{text: contract}} style={{fontFamily: 'monospace'}}>
					{formatAddress(contract)}
				</Text>
			),
		},
		{
			title: 'Holder Address',
			dataIndex: 'holder',
			key: 'holder',
			width: 50,
			render: (holder: string) => (
				<Text copyable={{text: holder}} style={{fontFamily: 'monospace'}}>
					{formatAddress(holder)}
				</Text>
			),
		},
		{
			title: 'Last Updated',
			dataIndex: 'updatedAt',
			key: 'updatedAt',
			width: 80,
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
		<Table
			columns={columns}
			dataSource={data.map((item, index) => ({...item, key: index}))}
			loading={loading}
			scroll={{x: 1200}}
			pagination={{
				pageSize: 500,
				showSizeChanger: false,
				showPrevNextJumpers: false,
				showQuickJumper: false,
				showTotal: (total, range) =>
					`${range[0]}-${range[1]} of ${total} token holders`,
			}}
			size="middle"
			bordered
		/>
	);
};
