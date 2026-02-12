import * as React from 'react';
import LayoutShell from './LayoutShell';
import Navigator from './Navigator';
import AppHeader from './AppHeader';

export default function AppLayout({ children }) {
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    return (
        <React.Fragment>
            {drawerOpen && (
                <LayoutShell.SideDrawer onClose={() => setDrawerOpen(false)}>
                    <Navigator />
                </LayoutShell.SideDrawer>
            )}

            <LayoutShell.Root>
                <LayoutShell.Header>
                    <AppHeader onDrawerToggle={() => setDrawerOpen(true)} />
                </LayoutShell.Header>
                <LayoutShell.SideNav>
                    <Navigator />
                </LayoutShell.SideNav>
                <LayoutShell.Main>{children}</LayoutShell.Main>
            </LayoutShell.Root>
        </React.Fragment>
    );

}
