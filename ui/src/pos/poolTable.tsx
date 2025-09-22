import React from 'react';
import { Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface AccountStatus {
	inQueue: string[];
	locked: string;
	outQueue: string[];
	unlocked: string;
	availableVotes: string;
	forceRetired: string | null;
	forfeited: string;
}

interface AccountInfo {
	address: string;
	blockNumber: string;
	status: AccountStatus;
}

interface Config {
	addr: string;
	name: string;
	account: string;
	ToleranceMinutes: number;
	notifyChannel: string;
	diffPercentage: number;
}

interface TableData {
	config: Config;
	lastMatchTime: string;
	lastVotes: number;
	accountInfo: AccountInfo;
}

interface Props {
	data: TableData[];
	loading?: boolean;
}

const formatHexToNumber = (hexValue: string | null): string => {
	if (!hexValue) return '0';
	return parseInt(hexValue, 16).toLocaleString();
};

const formatAddress = (address: string): JSX.Element => {
	if (!address) return <>-</>;
	let url = "https://confluxscan.org/"
	if (!address.startsWith('cfx:')) {
		url += "pos/accounts"
	} else {
		url += "address"
	}
	return <a href={`${url}/${address}`} target={"_blank"}>
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

export const PoolTable: React.FC<Props> = ({ data, loading = false }) => {
	const columns: ColumnsType<TableData> = [
		{
			title: 'Contract Address',
			dataIndex: ['config', 'addr'],
			key: 'addr',
			render: (addr: string) => (
				<Text copyable={{ text: addr }} style={{ fontFamily: 'monospace' }}>
					{formatAddress(addr)}
				</Text>
			),
			width: 150,
		},
		{
			title: 'Name',
			dataIndex: ['config', 'name'],
			key: 'name',
			render: (name: string) => (
				<Tag color="blue" style={{ margin: 0 }}>
					{name}
				</Tag>
			),
			width: 120,
		},
		{
			title: 'Account',
			dataIndex: ['config', 'account'],
			key: 'account',
			render: (account: string) => (
				<Text copyable={{ text: account }} style={{ fontFamily: 'monospace' }}>
					{formatAddress(account)}
				</Text>
			),
			width: 150,
		},
		{
			title: 'Last Valid Time',
			dataIndex: 'lastMatchTime',
			key: 'lastMatchTime',
			render: (time: string) => formatDate(time),
			sorter: (a, b) => new Date(a.lastMatchTime).getTime() - new Date(b.lastMatchTime).getTime(),
			width: 180,
		},
		{
			title: 'Last Votes',
			dataIndex: 'lastVotes',
			key: 'lastVotes',
			render: (votes: number) => votes.toLocaleString(),
			sorter: (a, b) => a.lastVotes - b.lastVotes,
			align: 'right',
			width: 100,
		},
		{
			title: 'Locked',
			dataIndex: ['accountInfo', 'status', 'locked'],
			key: 'locked',
			render: (locked: string) => formatHexToNumber(locked),
			sorter: (a, b) => parseInt(a.accountInfo.status.locked, 16) - parseInt(b.accountInfo.status.locked, 16),
			align: 'right',
			width: 100,
		},
		{
			title: 'Unlocked',
			dataIndex: ['accountInfo', 'status', 'unlocked'],
			key: 'unlocked',
			render: (unlocked: string) => formatHexToNumber(unlocked),
			sorter: (a, b) => parseInt(a.accountInfo.status.unlocked, 16) - parseInt(b.accountInfo.status.unlocked, 16),
			align: 'right',
			width: 100,
		},
		{
			title: 'Force Retired',
			dataIndex: ['accountInfo', 'status', 'forceRetired'],
			key: 'forceRetired',
			render: (forceRetired: string | null) => (
				<Tag color={forceRetired ? 'red' : 'green'}>
					{forceRetired ? forceRetired : 'No'}
				</Tag>
			),
			align: 'center',
			width: 120,
		},
	];

	return (
		<Table
			columns={columns}
			dataSource={data.map((item, index) => ({ ...item, key: index }))}
			loading={loading}
			scroll={{ x: 1300 }}
			pagination={{
				pageSize: 100,
				showSizeChanger: true,
				showQuickJumper: true,
				showTotal: (total, range) =>
					`${range[0]}-${range[1]} of ${total} items`,
			}}
			size="middle"
		/>
	);
};
