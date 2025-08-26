// components/HeaderMenu.tsx
import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';

const { Header } = Layout;
const { Title } = Typography;

interface HeaderMenuProps {
	onMenuClick?: (key: string) => void;
}

export const HeaderMenu: React.FC<HeaderMenuProps> = ({ onMenuClick }) => {
	const [current, setCurrent] = useState('home');

	const handleClick = (e: any) => {
		setCurrent(e.key);
		onMenuClick?.(e.key);
	};

	return (
		<Header style={{
			display: 'flex',
			alignItems: 'center',
			padding: '0 24px'
		}}>
			<Title level={3} style={{ color: 'white', margin: 0, marginRight: '40px' }}>
				Cross-chain Explorer
			</Title>

			<Menu
				theme="dark"
				mode="horizontal"
				selectedKeys={[current]}
				// item={menuItems}
				onClick={handleClick}
				style={{
					flex: 1,
					borderBottom: 'none',
					background: 'transparent'
				}}>
				<Menu.Item key="reqs">
					<a href={`/?page=reqs`}>Cross-chain requests</a>
				</Menu.Item>
				<Menu.Item key="tokens">
					<a href={`/?page=tokens`}>Tokens</a>
				</Menu.Item>
			</Menu>
		</Header>
	);
};
