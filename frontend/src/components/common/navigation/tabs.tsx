import Tab, { tabClasses, TabProps } from "@mui/material/Tab";
import Tabs, { tabsClasses } from "@mui/material/Tabs";
import { styled } from "@mui/material/styles";
import { Home, Inbox, Tag, Library } from "lucide-react";
import { createLink, useRouterState, LinkProps } from "@tanstack/react-router";
import { Typography } from "@mui/material";
import { ReactElement } from "react";

interface StyledTabProps extends Omit<LinkProps, "children">, Omit<TabProps, "ref"> {
    label: string | ReactElement;
}

const StyledTab = createLink(
    styled(Tab)<StyledTabProps>(({ theme }) => ({
        lineHeight: "inherit",
        minHeight: 32,
        marginTop: 8,
        minWidth: 0,
        flexDirection: "row",
        letterSpacing: "1px",
        justifyContent: "center",
        gap: "0.5rem",
        textTransform: "uppercase",
        "& svg": {
            fontSize: 16,
            width: 16,
            height: 16,
        },
        "&:not(:last-child)": {
            marginRight: 24,
            [theme.breakpoints.up("sm")]: {
                marginRight: 60,
            },
        },
        [theme.breakpoints.up("md")]: {
            minWidth: 0,
        },
        [`& .${tabClasses.labelIcon}`]: {
            minHeight: 53,
        },
        [`& .${tabClasses.iconWrapper}`]: {
            marginBottom: 0,
        },
    }))
);

const TabLabel = styled(Typography)(({ theme }) => ({
    marginLeft: 8,
    lineHeight: "12px",
    [theme.breakpoints.down("sm")]: {
        marginLeft: 0,
        display: "none",
    },
}));

function NavItem({ label, ...props }: StyledTabProps) {
    return <StyledTab label={<TabLabel>{label}</TabLabel>} disableRipple {...props} />;
}

export default function NavTabs() {
    const location = useRouterState({ select: (s) => s.location });
    const basePath = location.pathname.split("/")[1];
    return (
        <Tabs
            textColor="inherit"
            value={"/" + basePath}
            sx={{
                boxShadow: "inset 0 1px 0 0 #efefef",
                backgroundColor: "background.paper",
                overflow: "visible",
                [`& .${tabsClasses.indicator}`]: {
                    bottom: "unset",
                    top: 0,
                    height: "1px",
                    backgroundColor: "background.paper",
                },
                [`& .${tabsClasses.flexContainer}`]: {
                    justifyContent: "center",
                },
            }}
        >
            <NavItem
                value={"/"}
                to="/"
                label={"Home"}
                icon={<Home />}
                //
            />
            <NavItem
                to="/inbox"
                value={"/inbox"}
                label={"Inbox"}
                icon={<Inbox />}
                //
            />
            <NavItem
                to="/tags"
                value={"/tags"}
                label={"Tags"}
                icon={<Tag />}
                //
            />
            <NavItem
                to="/library/browse"
                value={"/library"}
                label={"Library"}
                icon={<Library />}
                //
            />
        </Tabs>
    );
}
