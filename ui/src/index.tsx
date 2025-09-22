import React, {useEffect, useState} from 'react';
import './index.css';
import App from './App';
import {createRoot} from 'react-dom/client';
import {ReqIndex} from "./cross-req/reqIndex";
import {ReqDetail} from "./cross-req/reqDetail";
import {HeaderMenu} from "./header";
import { Card, Row, Col, Statistic, Typography, Button } from 'antd';
import {PoolMain} from "./pos/poolMain";
const { Title, Paragraph } = Typography;

const container = document.getElementById('root')!;
const root = createRoot(container); // createRoot(container!) if you use TypeScript


const HomePage: React.FC = () => {
	return (
		<div>
			<Row gutter={16} style={{ marginBottom: '24px' }}>
				<Col span={8}>
				</Col>
				<Col span={8}>
					<div style={{ textAlign: 'center', marginTop: '24px' }}>Welcome!</div>
				</Col>
				<Col span={8}>
				</Col>
			</Row>
		</div>
	);
};

const PageRouter = () => {
	const [page, setPage] = useState(<div>Welcome!</div>)

	useEffect(() => {
		const search = window.location.search
		const map = new Map();
		if (search) {
			const parts = search.replace('?', '').split('&');
			parts.forEach(part => {
				const pair = part.split('=');
				map.set(pair[0], pair[1]);
			})
		}
		let page = <HomePage/>
		let wantPage = map.get('page');
		switch (wantPage) {
			case 'reqs':
				page = <ReqIndex/>
				break;
			case 'tokens':
				page = <App/>
				break;
			case 'reqDetail':
				page = <ReqDetail reqId={map.get('reqId')} />
				break
			case 'pos':
				page = <PoolMain/>
				break;
		}
		setPage(page)
	}, [window.location.search])

	return page
}

root.render(
	<React.StrictMode>
		<HeaderMenu/>
		<PageRouter/>
	</React.StrictMode>
);
