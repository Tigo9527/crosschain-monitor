import React from 'react';
import {Table, Tag} from 'antd';
import type {ColumnsType} from 'antd/es/table';

export interface TransactionData {
	id: number;
	reqId: string;
	chainId: number;
	type: string;
	recipient: string | null;
	proposer: string;
	erc20: string;
	from: string;
	to: string;
	value: string;
	transactionHash: string;
	blockNumber: number;
	createdAt: string;
	updatedAt: string;
}

interface TransactionTableProps {
	count: number;
	data: TransactionData[];
	noReqIdCol?: boolean;
	loading?: boolean;
	onChange?: (page: number, pageSize: number)=>void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({data, onChange, count=0, loading = false, noReqIdCol = false}) => {
	const formatAddress = (address: string, row) => {
		if (!address) return '-';

		let txUrl = ''
		switch (row.chainId) {
			case 1: txUrl = `https://etherscan.io`; break;
			case 42161: txUrl = `https://arbiscan.io`; break;
			case 1030: txUrl = `https://evm.confluxscan.org`; break;
			default:
				return address;
		}
		let txOrAddr = address.length == 66 ? 'tx' : 'address'

		return <a target={"_blank"} href={`${txUrl}/${txOrAddr}/${address}`}>{address.slice(0, 6)}...{address.slice(-4)}</a>;
	};

	const formatValue = (value: string, record: any) => {
		if (!value || value == '0') {
			return '-';
		}
		// Assuming value is in wei, convert to ether
		const etherValue = Number(value) / (record.chainId == 1030 ? 1e18 : 1e6);
		return `${etherValue}`;
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString();
	};

	const columns: ColumnsType<TransactionData> = [
		{
			title: 'ID',
			dataIndex: 'id',
			key: 'id',
			width: 60,
		},
		{
			title: 'Type',
			dataIndex: 'type',
			key: 'type',
			render: (type: string) => (
				<Tag color={type === 'TokenBurnExecuted' ? 'red' : 'blue'}>
					{type}
				</Tag>
			),
		},
		{
			title: 'Chain',
			dataIndex: 'chainId',
			key: 'chainId',
			render: (chainId: number) => `${chainId}`,
		},
		{
			title: 'ReqId',
			dataIndex: 'reqId',
			key: 'reqId',
			render: (reqId: string) => {
				return <a href={`/?page=reqDetail&reqId=${reqId}`}>{reqId.substring(6, 18)}</a>
			},
		},/*
		{
			title: 'From',
			dataIndex: 'from',
			key: 'from',
			render: (from: string) => formatAddress(from),
		},
		{
			title: 'To',
			dataIndex: 'to',
			key: 'to',
			render: (to: string) => formatAddress(to),
		},*/
		{
			title: 'Amount',
			dataIndex: 'value',
			key: 'value',
			render: (value: string, record) => formatValue(value, record),
			align: 'right',
		},
		{
			title: 'Proposer/Recipient',
			dataIndex: 'proposer',
			key: 'proposer',
			render: (proposer: string, row) => {
				return <>
					{formatAddress(proposer, row)}
					/
					{formatAddress(row.recipient!, row)}
				</>
			},
		},
		{
			title: 'Block Number',
			dataIndex: 'blockNumber',
			key: 'blockNumber',
			render: (blockNumber: number) => blockNumber.toLocaleString(),
		},
		{
			title: 'Transaction Hash',
			dataIndex: 'transactionHash',
			key: 'transactionHash',
			render: (hash: string, row) => {

				return formatAddress(hash, row)
			},
		},
		{
			title: 'Created At',
			dataIndex: 'createdAt',
			key: 'createdAt',
			render: (date: string) => formatDate(date),
			sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		},
		/*{
			title: 'Updated At',
			dataIndex: 'updatedAt',
			key: 'updatedAt',
			render: (date: string) => formatDate(date),
			sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
		},*/
	].filter(col=>col.key !== 'reqId' || !noReqIdCol) as any[];

	return (
		<Table
			columns={columns}
			dataSource={data.map(item => ({...item, key: item.id}))}
			loading={loading}
			scroll={{x: 1500}}
			pagination={{
				pageSize: 10,
				showSizeChanger: false,
				showQuickJumper: false,
				total: count,
				onChange: onChange,
				showTotal: (total, range) =>
					`${range[0]}-${range[1]} of ${total} items`,
			}}
		/>
	);
};
