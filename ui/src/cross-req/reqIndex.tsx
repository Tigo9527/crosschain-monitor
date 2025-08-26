import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import {getHost} from "../common/Util";
import {TransactionTable} from "./reqTable";

export const ReqIndex: React.FC = () => {
	const [data, setData] = useState<any[]>([]);
	const [count, setCount] = useState<number>(0);
	const [offSet, setOffset] = useState<number>(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Simulate API call
		const fetchData = async () => {
			try {
				// Replace with your actual API call
				const response = await fetch(`${getHost()}/req?offset=${offSet}`);
				const result = await response.json();
				setData(result.list);
				setCount(result.count);
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchData().catch(e=>{
			console.error('Error fetching data:', e);
		});
	}, [offSet]);

	return (
		<div style={{ padding: '24px' }}>
			<h1>Tunnel events</h1>
			<TransactionTable data={data} count={count} loading={loading} onChange={(page, pageSize)=>{
				setOffset((page - 1) * pageSize);
			}}/>
		</div>
	);
};
