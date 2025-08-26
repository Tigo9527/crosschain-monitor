import React, { useState, useEffect } from 'react';
import {getHost} from "../common/Util";
import {TransactionTable} from "./reqTable";
import {Input, Space} from "antd";

export const ReqIndex: React.FC = () => {
	const [data, setData] = useState<any[]>([]);
	const [count, setCount] = useState<number>(0);
	const [offset, setOffset] = useState<number>(0);
	const [loading, setLoading] = useState(true);
	const [input, setInput] = useState('')

	useEffect(() => {
		// Simulate API call
		const fetchData = async () => {
			try {
				// Replace with your actual API call
				const response = await fetch(`${getHost()}/req?offset=${offset}`);
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
	}, [offset]);

	return (
		<div style={{ padding: '24px' }}>
				<h1>Tunnel events</h1>
			<Space style={{marginBottom: '24px'}}>
				ReqID: <Input value={input}
				              allowClear={true}
				              onChange={(e) => setInput(e.target.value)} />
				Link: <a href={`/?page=reqDetail&reqId=${input}`}>{input}</a>
			</Space>
			<div>offset {offset}</div>
			<TransactionTable data={data} count={count+20} loading={loading} onChange={(page, pageSize)=>{
				setOffset((page - 1) * pageSize);
			}}/>
		</div>
	);
};
