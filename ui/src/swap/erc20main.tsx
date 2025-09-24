import React, { useState, useEffect } from 'react';
import { Spin, Card, Row, Col, Statistic } from 'antd';
import {TokenSupplyTable} from "./erc20table";
import {defiApiUrl} from "../common/Util";

export const Erc20main: React.FC = () => {
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Simulate API response
				const mockResponse = await fetch(`${defiApiUrl}/defi/api/erc20-supplies/list`)
					.then(r => r.json());

				setData(mockResponse.data.list);

			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	if (loading) {
		return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;
	}

	return (
		<div style={{ padding: '0px' }}>
			<h1>ERC20 Token Supply Dashboard</h1>

			<TokenSupplyTable data={data} loading={loading} />
		</div>
	);
};
